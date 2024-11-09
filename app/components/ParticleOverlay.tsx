'use client';

import React, { useRef, useEffect, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  speedX: number;
  speedY: number;
  alpha: number;
  points: { x: number; y: number }[];
}

interface ParticleOverlayProps {
  audioElement?: HTMLAudioElement | null;
  isPlaying: boolean;
}

const ParticleOverlay: React.FC<ParticleOverlayProps> = ({ audioElement, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const lastBassImpactRef = useRef(0);
  const bassAccumulatorRef = useRef(0);
  

  const createAshPoints = (size: number) => {
    const points = [];
    const numPoints = Math.floor(Math.random() * 3) + 5; 
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const randomRadius = size * (0.5 + Math.random() * 0.5);
      points.push({
        x: Math.cos(angle) * randomRadius,
        y: Math.sin(angle) * randomRadius
      });
    }
    return points;
  };

  useEffect(() => {
    if (!audioElement) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024; 
    
    const bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 150;
    bassFilter.Q.value = 1;

    const bassBoost = audioContext.createGain();
    bassBoost.gain.value = 2.0;

    const source = audioContext.createMediaElementSource(audioElement);
    source
      .connect(bassFilter)
      .connect(bassBoost)
      .connect(analyser)
      .connect(audioContext.destination);

    analyserRef.current = analyser;
    audioContextRef.current = audioContext;

    return () => {
      audioContext.close();
    };
  }, [audioElement]);

  const createParticle = (canvas: HTMLCanvasElement, intense = false): Particle => {
    const baseSize = intense ? 
      Math.random() * 3 + 2 : 
      Math.random() * 2 + 1;
    
    return {
      x: Math.random() * canvas.width,
      y: intense ? canvas.height + 10 : Math.random() * canvas.height,
      size: baseSize,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      speedX: (Math.random() - 0.5) * 2,
      speedY: intense ? -Math.random() * 15 - 5 : -Math.random() * 2 - 1,
      alpha: Math.random() * 0.5 + 0.2,
      points: createAshPoints(baseSize)
    };
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array(200).fill(null).map(() => 
      createParticle(canvas)
    );
    particlesRef.current = particles;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const analyser = analyserRef.current;
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const drawAshParticle = (particle: Particle, ctx: CanvasRenderingContext2D) => {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = particle.alpha;

      ctx.beginPath();
      ctx.moveTo(particle.points[0].x, particle.points[0].y);
      for (let i = 1; i < particle.points.length; i++) {
        ctx.lineTo(particle.points[i].x, particle.points[i].y);
      }
      ctx.closePath();

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
      gradient.addColorStop(0, 'rgba(255, 150, 50, 0.2)');
      gradient.addColorStop(0.5, 'rgba(150, 150, 150, 0.2)');
      gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');

      ctx.fillStyle = 'rgba(120, 120, 120, 0.8)';
      ctx.fill();
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isPlaying) {
        analyser.getByteFrequencyData(freqData);
        
        const bassRange = freqData.slice(0, Math.floor(freqData.length * 0.1));
        const bassIntensity = Array.from(bassRange).reduce((a, b) => a + b, 0) / bassRange.length / 255;
        
        bassAccumulatorRef.current += bassIntensity;
        const now = Date.now();
        
        if (bassIntensity > 0.7 && now - lastBassImpactRef.current > 100) {
          const burstCount = Math.floor(bassIntensity * 20);
          for (let i = 0; i < burstCount; i++) {
            particlesRef.current.push(createParticle(canvas, true));
          }
          lastBassImpactRef.current = now;
        }

        particlesRef.current.forEach(particle => {
          particle.speedY *= (.6+ bassIntensity * 1.4);
          particle.rotationSpeed *= (.5 + bassIntensity * 0.3);
          particle.alpha = Math.min(1, particle.alpha * (1 + bassIntensity));
        });
      }

      particlesRef.current = particlesRef.current.filter(particle => {
        particle.y += particle.speedY;
        particle.x += particle.speedX;
        particle.rotation += particle.rotationSpeed;
        particle.alpha *= 0.99;

        if (particle.y < -20 || particle.alpha < 0.01) {
          return false;
        }

        drawAshParticle(particle, ctx);
        return true;
      });

      while (particlesRef.current.length < 200) {
        particlesRef.current.push(createParticle(canvas));
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};

export default ParticleOverlay;
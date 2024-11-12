'use client';

import React, { useRef, useEffect } from 'react';

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
  analyserNode?: AnalyserNode | null;
  isPlaying: boolean;
}

const ParticleOverlay: React.FC<ParticleOverlayProps> = ({ 
  analyserNode, 
  isPlaying 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>();
  const lastBassImpactRef = useRef(0);

  const createAshPoints = (size: number) => {
    const points = [];
    const numPoints = Math.floor(Math.random() * 4) + 6; 
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const randomRadius = size * (0.3 + Math.random() * 0.7); 
      points.push({
        x: Math.cos(angle) * randomRadius,
        y: Math.sin(angle) * randomRadius
      });
    }
    return points;
  };

  const createParticle = React.useCallback((canvas: HTMLCanvasElement, intense = false): Particle => {
    const baseSize = intense ? 
      Math.random() * 4 + 3 : 
      Math.random() * 3 + 2;
    
    return {
      x: Math.random() * canvas.width,
      y: intense ? canvas.height + 10 : Math.random() * canvas.height,
      size: baseSize,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05, 
      speedX: (Math.random() - 0.5) * (intense ? 3 : 1), 
      speedY: intense ? -Math.random() * 6 - 4 : -Math.random() * 1.5 - 0.5, 
      alpha: Math.random() * 0.4 + 0.2,
      points: createAshPoints(baseSize)
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  
    // Increase initial particle count
    const particles: Particle[] = Array(500).fill(null).map(() => 
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
    if (!canvasRef.current || !analyserNode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const freqData = new Uint8Array(analyserNode.frequencyBinCount);

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
    
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size * 1.5);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)'); 
      gradient.addColorStop(0.5, 'rgba(200, 200, 200, 0.4)');
      gradient.addColorStop(1, 'rgba(150, 150, 150, 0)');
    
      ctx.fillStyle = gradient;
      ctx.fill();
    
      ctx.globalAlpha = particle.alpha * 0.6;
      const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size * 2.5);
      glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glowGradient;
      ctx.fill();
    
      ctx.restore();
    };
    

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let bassIntensity = 0;
      if (isPlaying) {
        analyserNode.getByteFrequencyData(freqData);
        const bassRange = freqData.slice(0, Math.floor(freqData.length * 0.1));
        bassIntensity = Array.from(bassRange).reduce((a, b) => a + b, 0) / bassRange.length / 255;
        
        // more particles on bass hits
        if (bassIntensity > 0.5 && Date.now() - lastBassImpactRef.current > 50) {
          const burstCount = Math.floor(bassIntensity * 50); 
          for (let i = 0; i < burstCount; i++) {
            particlesRef.current.push(createParticle(canvas, true));
          }
          lastBassImpactRef.current = Date.now();
        }
      }

      particlesRef.current = particlesRef.current.filter(particle => {
        if (isPlaying) {
          particle.y += particle.speedY * (1 + bassIntensity * .7);
          particle.x += particle.speedX * (1 + bassIntensity);
          particle.rotation += particle.rotationSpeed;
          particle.alpha *= 0.997;
    
          particle.speedY *= (0.7 + bassIntensity * 1.5);
          particle.rotationSpeed *= (0.6 + bassIntensity * 0.4);
        }
    
        if (particle.y < -20 || particle.alpha < 0.01) {
          return false;
        }
    
        drawAshParticle(particle, ctx);
        return true;
      });

      while (particlesRef.current.length < 500) {
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
  }, [isPlaying, analyserNode]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};

export default ParticleOverlay;
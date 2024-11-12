'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import ParticleOverlay from './ParticleOverlay';

interface PerspectiveViewerProps {
  videoPath: string;
  audioPath?: string;
  smoothingFactor?: number;
  frameRate?: number;
  hasInteracted: boolean;
}

const PerspectiveViewer: React.FC<PerspectiveViewerProps> = ({ 
  videoPath,
  audioPath = '/teethr.mp3',
  smoothingFactor = 0.99,
  frameRate = 60,
  hasInteracted
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [distortionLevel, setDistortionLevel] = useState(0);
  const [showInterface, setShowInterface] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState('initializing');
  const [videoSize, setVideoSize] = useState({ width: 16, height: 9 });
  const [isMoving, setIsMoving] = useState(false);
  const moveTimeoutRef = useRef<NodeJS.Timeout>();
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const isSeekingRef = useRef(false);

  const containerStyle = React.useMemo(() => {
    return {
      width: '100vw',
      height: '100vh',
    };
  }, []);

  const updateCanvasSize = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;


    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const videoAspect = video.videoWidth / video.videoHeight;
    const windowAspect = window.innerWidth / window.innerHeight;
    
    let scale;
    let offsetX = 0;
    let offsetY = 0;
    
    if (windowAspect > videoAspect) {
      scale = window.innerWidth / video.videoWidth;
      offsetY = (window.innerHeight - (video.videoHeight * scale)) / 2;
    } else {
      scale = window.innerHeight / video.videoHeight;
      offsetX = (window.innerWidth - (video.videoWidth * scale)) / 2;
    }

    contextRef.current = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });

    if (contextRef.current) {
      contextRef.current.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkAudioLoaded = () => {
      if (audioRef.current) {
        audioRef.current.addEventListener('canplaythrough', () => {
          setAudioLoaded(true);
        }, { once: true });
      }
    };
  
    checkAudioLoaded();
  }, [audioPath]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
  
    video.preload = 'auto';
  
    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded:', {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      });
      setDuration(video.duration);
      setLoadingState('metadata_loaded');
      updateCanvasSize();
      video.currentTime = 0;
    };
  
    const handleLoadedData = () => {
      console.log('Video data loaded');
      updateCanvasSize();
      if (contextRef.current) {
        contextRef.current.drawImage(video, 0, 0);
      }
      setIsLoaded(true);
      setLoadingState('ready');
      video.pause();
    };
  
    const handleError = (e: ErrorEvent) => {
      console.error('Video error:', e);
      setError(e.message);
      setLoadingState('error');
    };
  
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
  
    video.load();
  
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, [videoPath]);
  

  
  useEffect(() => {
    if (videoPath.includes('terrible')) {
      const handleResize = () => {
        updateCanvasSize();
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [videoPath]);
  
  useEffect(() => {
    let lastTime = 0;
    const interval = 1000 / frameRate;

    const addNoise = () => {
      if (!contextRef.current || !videoRef.current) return;
      const imageData = contextRef.current.getImageData(
        0, 0, 
        videoRef.current.videoWidth, 
        videoRef.current.videoHeight
      );
      
      contextRef.current.putImageData(imageData, 0, 0);
    };

    const animate = (time: number) => {
      if (!isLoaded || !videoRef.current || !contextRef.current || !audioRef.current) return;

      const elapsed = time - lastTime;
      if (elapsed < interval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const video = videoRef.current;
      const audio = audioRef.current;
      const delta = targetTimeRef.current - currentTimeRef.current;
      
      const ease = 1 - Math.pow(smoothingFactor, elapsed / 16.67);
      currentTimeRef.current += delta * ease;

      if (!isSeekingRef.current) {
        try {
          video.currentTime = currentTimeRef.current;
          
          contextRef.current.clearRect(0, 0, video.videoWidth, video.videoHeight);
          
          contextRef.current.drawImage(video, 0, 0);

          const movement = Math.abs(delta);
          setDistortionLevel(movement * 50);
          
          addNoise();
          
          if (movement > 0.01) {
            const strength = movement * 10;
            contextRef.current.drawImage(video, strength, 0);
            contextRef.current.drawImage(video, -strength, 0);
            contextRef.current.globalCompositeOperation = 'source-over';
          }
          
          lastTime = time;
        } catch (err) {
          console.error('Frame update error:', err);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isLoaded && audioLoaded) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoaded, audioLoaded, smoothingFactor, frameRate, distortionLevel]);

  useEffect(() => {
    const initAudioContext = async () => {
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.value = 150;
        bassFilter.Q.value = 1;
  
        const bassBoost = ctx.createGain();
        bassBoost.gain.value = 2.0;
  
        if (audioRef.current && !audioSourceRef.current) {
          const source = ctx.createMediaElementSource(audioRef.current);
          audioSourceRef.current = source;
          
          source
            .connect(bassFilter)
            .connect(bassBoost)
            .connect(analyser)
            .connect(ctx.destination);
        }
  
        setAudioContext(ctx);
        analyserRef.current = analyser;
      } catch (err) {
        console.error('Audio context initialization failed:', err);
      }
    };
  
    if (hasInteracted) {
      initAudioContext();
    }
  }, [hasInteracted]);

  const handleMouseMove = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoaded || !audioRef.current) return;
    
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    setMousePosition({ x, y });
    targetTimeRef.current = Math.max(0, Math.min(x * duration, duration - 0.01));
  
    if (!isMoving) {
      setIsMoving(true);
      if (audioContext?.state === 'suspended') {
        await audioContext.resume();
      }
      try {
        if (audioRef.current?.paused) {
          await audioRef.current.play();
        }
      } catch (err) {
        console.error('Audio play failed:', err);
      }
    }
  
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
    }
  
    moveTimeoutRef.current = setTimeout(() => {
      setIsMoving(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }, 50);
  
    setShowInterface(false);
    setTimeout(() => setShowInterface(true), 2000);
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0.5, y: 0.5 });
    setShowInterface(true);
    setIsMoving(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  return (
    <div 
      className="relative w-screen h-screen bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="fixed inset-0 bg-black opacity-50 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, transparent 0%, black 70%)`
        }}
      />
      
      <div 
        ref={containerRef}
        className="relative select-none w-screen h-screen"
        style={containerStyle}
      >
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
          preload="auto"
        >
          <source src={videoPath} type="video/mp4" />
        </video>
  
        <audio
          ref={audioRef}
          preload="auto"
          loop
        >
          <source src={audioPath} type="audio/mpeg" />
        </audio>
  
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover shadow-2xl"
          style={{
            filter: `contrast(1.1) saturate(${1 + distortionLevel * 0.01})`,
          }}
        />
        
        {!isLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 text-white">
            <Loader className="w-8 h-8 animate-spin mb-4" />
            <div className="text-sm font-mono">{loadingState}</div>
            {error && (
              <div className="mt-2 text-red-400 text-xs max-w-md text-center px-4">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
  
      <ParticleOverlay 
        analyserNode={analyserRef.current}
        isPlaying={isMoving}
      />
      
      {showInterface && (
        <div className="fixed bottom-4 left-4 text-white text-xs font-mono opacity-50">
          <div>TIME: {currentTimeRef.current.toFixed(2)}/{duration.toFixed(2)}</div>
          <div>DISTORTION: {(distortionLevel * 100).toFixed(0)}%</div>
          <div>POSITION: {(mousePosition.x * 100).toFixed(0)}%</div>
          <div>AUDIO: {isMoving ? 'PLAYING' : 'PAUSED'}</div>
        </div>
      )}
    </div>
  );
}

export default PerspectiveViewer;
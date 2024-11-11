'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import ParticleOverlay from './ParticleOverlay';

interface PerspectiveViewerProps {
  videoPath: string;
  audioPath?: string;
  smoothingFactor?: number;
  frameRate?: number;
}

const PerspectiveViewer: React.FC<PerspectiveViewerProps> = ({ 
  videoPath,
  audioPath = '/teeth.mp3',
  smoothingFactor = 0.99,
  frameRate = 60
}) => {
  const [hasInteracted, setHasInteracted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
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
    const aspectRatio = videoSize.width / videoSize.height;
    const vh = Math.min(window.innerHeight * 0.5, 500);
    const vw = Math.min(window.innerWidth * 0.5, 800);
    
    let width;
    let height;
    
    if (vw / vh > aspectRatio) {
      height = vh;
      width = vh * aspectRatio;
    } else {
      width = vw;
      height = vw / aspectRatio;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  }, [videoSize]);


  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !audio) return;

    video.preload = 'auto';
    audio.preload = 'auto';
    audio.volume = 0.5; 
    audio.loop = true; 

    const updateCanvasSize = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        setVideoSize({
          width: video.videoWidth,
          height: video.videoHeight
        });
        contextRef.current = canvas.getContext('2d', {
          alpha: false,
          desynchronized: true
        });
      }
    };

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

    const handleAudioLoaded = () => {
      console.log('Audio loaded');
      setAudioLoaded(true);
      audio.pause(); 
    };

    const handleAudioError = (e: ErrorEvent) => {
      console.error('Audio error:', e);
      setError(prev => prev || 'Audio failed to load');
    };

    const handleError = (e: ErrorEvent) => {
      console.error('Video error:', e);
      setError(e.message);
      setLoadingState('error');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    audio.addEventListener('loadeddata', handleAudioLoaded);
    audio.addEventListener('error', handleAudioError);

    video.load();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleAudioLoaded);
      audio.removeEventListener('error', handleAudioError);
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [videoPath, audioPath]);

  // Animation and effects
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
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * distortionLevel;
        data[i] += noise;     // R
        data[i + 1] += noise; // G
        data[i + 2] += noise; // B
      }
      
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
            contextRef.current.globalCompositeOperation = 'screen';
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

  const handleMouseMove = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoaded || !audioRef.current || !hasInteracted) return;
    
    if (!audioContext) {
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
  
        // Only create source if it doesn't exist
        if (!audioSourceRef.current) {
          const source = ctx.createMediaElementSource(audioRef.current);
          audioSourceRef.current = source;
          
          // Connect the audio chain
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
    }
  
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
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {!hasInteracted && (
        <div 
          className="fixed inset-0 bg-black cursor-pointer z-50"
          onClick={async () => {
            setHasInteracted(true);
            if (audioContext?.state === 'suspended') {
              await audioContext.resume();
            }
          }}
        />
      )}
      <div 
        className="fixed inset-0 bg-black opacity-50 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, transparent 0%, black 70%)`
        }}
      />
      
      <div 
        ref={containerRef}
        className="relative select-none"
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
          className="w-full h-full object-contain shadow-2xl"
          style={{
            filter: `contrast(1.1) saturate(${1 + distortionLevel * 0.01})`,
          }}
        />
        
        {(!isLoaded || !audioLoaded) && (
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
      isPlaying={isMoving && hasInteracted}
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
};

export default PerspectiveViewer;
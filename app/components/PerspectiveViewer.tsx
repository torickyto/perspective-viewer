'use client';

import React, { useRef, useEffect, useState } from 'react';

interface PerspectiveViewerProps {
  videoPath: string;
  smoothingFactor?: number;
  frameRate?: number;
}

const PerspectiveViewer: React.FC<PerspectiveViewerProps> = ({ 
  videoPath,
  smoothingFactor = 0.99,
  frameRate = 60
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState('initializing');
  const [debugInfo, setDebugInfo] = useState({ current: 0, target: 0 });
  const [videoSize, setVideoSize] = useState({ width: 16, height: 9 }); // Default 16:9

  // Refs for smooth animation
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();
  const isSeekingRef = useRef(false);

  // Calculate container dimensions
  const containerStyle = React.useMemo(() => {
    const aspectRatio = videoSize.width / videoSize.height;
    const vh = Math.min(window.innerHeight * 0.5, 500); // 50% of viewport height, max 500px
    const vw = Math.min(window.innerWidth * 0.5, 800); // 50% of viewport width, max 800px
    
    let width;
    let height;
    
    if (vw / vh > aspectRatio) {
      // Height limited
      height = vh;
      width = vh * aspectRatio;
    } else {
      // Width limited
      width = vw;
      height = vw / aspectRatio;
    }

    return {
      width: `${width}px`,
      height: `${height}px`
    };
  }, [videoSize]);

  // Initialize video and canvas
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    video.preload = 'auto';

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

    const handleSeeking = () => {
      isSeekingRef.current = true;
    };

    const handleSeeked = () => {
      isSeekingRef.current = false;
      if (contextRef.current) {
        contextRef.current.drawImage(video, 0, 0);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);

    video.load();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [videoPath]);

  // Animation loop
  useEffect(() => {
    let lastTime = 0;
    const interval = 1000 / frameRate;

    const animate = (time: number) => {
      if (!isLoaded || !videoRef.current || !contextRef.current) return;

      const elapsed = time - lastTime;
      if (elapsed < interval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const video = videoRef.current;
      const delta = targetTimeRef.current - currentTimeRef.current;
      
      // Smooth easing
      const ease = 1 - Math.pow(smoothingFactor, elapsed / 16.67);
      currentTimeRef.current += delta * ease;

      if (!isSeekingRef.current) {
        try {
          video.currentTime = currentTimeRef.current;
          contextRef.current.drawImage(video, 0, 0);
          lastTime = time;

          setDebugInfo({
            current: currentTimeRef.current,
            target: targetTimeRef.current
          });
        } catch (err) {
          console.error('Frame update error:', err);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isLoaded) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoaded, smoothingFactor, frameRate]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoaded || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const newTargetTime = Math.max(0, Math.min(mouseX * duration, duration - 0.01));
    
    targetTimeRef.current = newTargetTime;
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative select-none bg-black"
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

        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />
        
        {!isLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-50 text-white">
            <div className="text-xl mb-2">Loading... ({loadingState})</div>
            {error && (
              <div className="text-red-400 text-sm max-w-md text-center px-4">
                Error: {error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 text-sm rounded">
        Duration: {duration.toFixed(2)}s<br />
        Current: {debugInfo.current.toFixed(2)}s<br />
        Target: {debugInfo.target.toFixed(2)}s<br />
        State: {isSeekingRef.current ? 'Seeking' : 'Ready'}
      </div>
    </div>
  );
};

export default PerspectiveViewer;
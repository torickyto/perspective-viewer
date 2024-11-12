'use client';

import React, { useState } from 'react';
import PerspectiveViewer from './components/PerspectiveViewer';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 text-red-700">
          <h1>Something went wrong.</h1>
          <pre className="mt-2 text-sm">{this.state.error?.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function Home() {
  const [currentVideo, setCurrentVideo] = useState<'angel' | 'terrible'>('angel');
  const [globalHasInteracted, setGlobalHasInteracted] = useState(false);

  const toggleVideo = () => {
    setCurrentVideo(current => current === 'angel' ? 'terrible' : 'angel');
  };

  return (
    <ErrorBoundary>
      <main className="w-screen h-screen bg-black">
        <button 
          onClick={toggleVideo}
          className="fixed top-8 left-1/2 -translate-x-1/2 z-50 font-mono text-white/70 text-xl hover:text-white/90 transition-colors duration-300"
        >
          Иван IV Васильевич
        </button>

        {!globalHasInteracted && (
          <div 
            className="fixed inset-0 bg-black cursor-pointer z-40"
            onClick={() => setGlobalHasInteracted(true)}
          />
        )}

        <div className="w-screen h-screen">
          <PerspectiveViewer 
            key={currentVideo}
            videoPath={'/videos/terribleb.mp4'}
            audioPath="/teethr.mp3"
            smoothingFactor={0.999}
            frameRate={60}
            hasInteracted={globalHasInteracted}
          />
        </div>
      </main>
    </ErrorBoundary>
  );
}
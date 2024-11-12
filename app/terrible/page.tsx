'use client';

import React from 'react';
import Link from 'next/link';
import PerspectiveViewer from '../components/PerspectiveViewer';

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

export default function TerriblePage() {
  return (
    <ErrorBoundary>
      <main className="w-screen h-screen bg-black">
        <Link 
          href="/" 
          className="fixed top-8 left-1/2 -translate-x-1/2 z-50 font-mono text-white/70 text-xl hover:text-white/90 transition-colors duration-300"
        >
          Иван IV Васильевич
        </Link>
        <div className="w-screen h-screen">
          <PerspectiveViewer 
            videoPath="/videos/terribleb.mp4" 
            audioPath="/teethr.mp3"
            smoothingFactor={0.999}
            frameRate={60}
          />
        </div>
      </main>
    </ErrorBoundary>
  );
}
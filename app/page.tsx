'use client';

import React from 'react';
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
  return (
    <ErrorBoundary>
      <main className="w-screen h-screen bg-black">
        <PerspectiveViewer 
          videoPath="/videos/fallenangel.mp4" 
          smoothingFactor={0.999}
          frameRate={60}
        />
      </main>
    </ErrorBoundary>
  );
}
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ fullScreen = false }) => {
  if (fullScreen) {
    return (
      <div
        id="app-loading-screen"
        className="fixed inset-0 z-50 flex items-center justify-center bg-surface/90 backdrop-blur-xs transition-opacity duration-200"
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-9 h-9 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[250px] flex flex-col items-center justify-center gap-3 py-12 text-text-muted animate-fade-in">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
};

export default LoadingScreen;

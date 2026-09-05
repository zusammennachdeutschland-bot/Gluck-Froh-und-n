import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Lade Daten...',
}) => {
  return (
    <div
      id="app-loading-screen"
      className="min-h-screen w-full flex flex-col items-center justify-center bg-surface dark:bg-background text-center px-4 select-none"
    >
      <div className="animate-pulse flex flex-col items-center justify-center space-y-2">
        <p className="text-lg sm:text-xl font-medium tracking-wide text-slate-500 dark:text-slate-400">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;

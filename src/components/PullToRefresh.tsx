import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  pullText?: string;
  releaseText?: string;
  refreshingText?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  pullText = 'اسحب للتحديث...',
  releaseText = 'اترك للتحديث الآن',
  refreshingText = 'جارٍ تحديث البيانات...'
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPullingRef = useRef(false);

  const THRESHOLD = 70; // px required to trigger refresh
  const MAX_PULL = 110;  // max visual displacement

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    // Only allow pulling if scrolled to top
    if (container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    } else {
      startYRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    if (container.scrollTop > 0) {
      // User scrolled down inside the element, cancel pull
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      // Dampen the pull distance (logarithmic resistance like iOS / Facebook)
      const dampened = Math.min(MAX_PULL, diff * 0.45);
      setPullDistance(dampened);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || isRefreshing) return;
    isPullingRef.current = false;
    startYRef.current = null;

    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(50); // Keep spinner visible during refresh

      try {
        await Promise.resolve(onRefresh());
      } catch (err) {
        console.error('Pull to refresh error:', err);
      } finally {
        // Smooth timeout
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 500);
      }
    } else {
      setPullDistance(0);
    }
  };

  const isTriggered = pullDistance >= THRESHOLD;
  const progress = Math.min(1, pullDistance / THRESHOLD);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-y-auto ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Pull Indicator Area */}
      <div
        className="absolute left-0 right-0 top-0 z-20 flex flex-col items-center justify-center pointer-events-none transition-transform duration-100 ease-out"
        style={{
          transform: `translateY(${Math.max(0, pullDistance - 45)}px)`,
          opacity: pullDistance > 10 ? Math.min(1, pullDistance / 40) : 0,
        }}
      >
        <div className="flex items-center gap-2 bg-surface/95 dark:bg-background/95 border border-surface-border/80 dark:border-surface-border px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md">
          <RefreshCw
            className={`w-4 h-4 text-primary transition-transform duration-150 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
          <span className="text-[11px] font-bold text-text-main">
            {isRefreshing ? refreshingText : isTriggered ? releaseText : pullText}
          </span>
        </div>
      </div>

      {/* Content wrapper shifted down when pulled */}
      <div
        className="transition-transform duration-150 ease-out"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.75}px)` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

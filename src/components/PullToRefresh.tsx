import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  pullText?: string;
  releaseText?: string;
  refreshingText?: string;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  pullText = 'اسحب للتحديث...',
  releaseText = 'اترك للتحديث الآن',
  refreshingText = 'جارٍ تحديث البيانات...',
  disabled = false,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPullingRef = useRef(false);

  const THRESHOLD = 70; // px required to trigger refresh
  const MAX_PULL = 110;  // max visual displacement

  // Helper to check if touch is inside a modal/card/dialog or if any modal is currently open
  const isModalOrCardActive = (target: HTMLElement | null): boolean => {
    if (disabled) return true;
    
    // Check if target is inside any modal, card, dialog, sheet, or fixed overlay
    if (target?.closest('[role="dialog"], [data-modal], [data-no-pull], [data-prevent-pull], .fixed, .modal-overlay, .modal-content, select, input, textarea')) {
      return true;
    }

    // Check if any modal is open in the DOM
    if (document.querySelector('[role="dialog"], [data-modal="true"], .fixed.inset-0')) {
      return true;
    }

    return false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    const target = e.target as HTMLElement | null;
    if (isModalOrCardActive(target)) {
      startYRef.current = null;
      isPullingRef.current = false;
      return;
    }

    // Check if touch target has an inner scrollable parent with scrollTop > 0
    let cur: HTMLElement | null = target;
    while (cur && cur !== container) {
      if (cur.scrollTop > 0) {
        startYRef.current = null;
        isPullingRef.current = false;
        return;
      }
      cur = cur.parentElement;
    }

    // Only allow pulling if the root container is scrolled to top
    if (container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    } else {
      startYRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isPullingRef.current || startYRef.current === null || isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    const target = e.target as HTMLElement | null;
    if (isModalOrCardActive(target)) {
      isPullingRef.current = false;
      startYRef.current = null;
      setPullDistance(0);
      return;
    }

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
    if (disabled || !isPullingRef.current || isRefreshing) {
      isPullingRef.current = false;
      startYRef.current = null;
      setPullDistance(0);
      return;
    }
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

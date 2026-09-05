import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { networkMonitorService, NetworkMetrics, ConnectionQuality } from '../services/networkMonitorService';
import { Activity, Wifi, WifiOff, X, ArrowUpRight, ArrowDownRight, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const FloatingNetworkMonitor: React.FC = () => {
  const { activeLessonSession, language } = useApp();
  const [metrics, setMetrics] = useState<NetworkMetrics>(() => networkMonitorService.getMetrics());
  const [showPopover, setShowPopover] = useState(false);
  const isArabic = language === 'ar';

  // Draggable position coordinates (default: top-right or top-left with safe margins)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
  });
  const pillRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 1. Session Lifecycle Control: Start on active session, stop when session ends
  const isSessionActive = Boolean(activeLessonSession);

  useEffect(() => {
    if (isSessionActive) {
      networkMonitorService.start();
      const unsubscribe = networkMonitorService.subscribe((latest) => {
        setMetrics(latest);
      });
      return () => {
        unsubscribe();
      };
    } else {
      networkMonitorService.stop();
      setShowPopover(false);
    }
  }, [isSessionActive, activeLessonSession?.lessonId]);

  // Click outside listener to dismiss Popover
  useEffect(() => {
    if (!showPopover) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        pillRef.current &&
        !pillRef.current.contains(target)
      ) {
        setShowPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPopover]);

  // If no active lesson, render nothing (completely unmounted & zero overhead)
  if (!isSessionActive) {
    return null;
  }

  // Quality Text & Color mapping
  const qualityMap: Record<ConnectionQuality, { labelEn: string; labelAr: string; dotClass: string; badgeClass: string }> = {
    excellent: {
      labelEn: 'Excellent',
      labelAr: 'ممتاز',
      dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    good: {
      labelEn: 'Good',
      labelAr: 'جيد',
      dotClass: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    fair: {
      labelEn: 'Fair',
      labelAr: 'مقبول',
      dotClass: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    poor: {
      labelEn: 'Poor',
      labelAr: 'ضعيف',
      dotClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    offline: {
      labelEn: 'Offline',
      labelAr: 'غير متصل',
      dotClass: 'bg-slate-500',
      badgeClass: 'bg-slate-700/50 text-slate-300 border-slate-600'
    },
    unavailable: {
      labelEn: 'Unavailable',
      labelAr: 'غير متوفر',
      dotClass: 'bg-slate-400',
      badgeClass: 'bg-slate-700/50 text-slate-400 border-slate-600'
    }
  };

  const currentQualityInfo = qualityMap[metrics.connectionQuality];

  // Drag Handlers for free movement on screen
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with primary pointer button
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const el = pillRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const currentX = position ? position.x : rect.left;
    const currentY = position ? position.y : rect.top;

    isDraggingRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - dragStartRef.current.startX;
      const deltaY = moveEvent.clientY - dragStartRef.current.startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current) {
        const nextX = Math.max(10, Math.min(window.innerWidth - (rect.width || 120) - 10, dragStartRef.current.initialX + deltaX));
        const nextY = Math.max(10, Math.min(window.innerHeight - (rect.height || 40) - 10, dragStartRef.current.initialY + deltaY));
        setPosition({ x: nextX, y: nextY });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePillClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.stopPropagation();
      return;
    }
    setShowPopover((prev) => !prev);
  };

  // Default Position Style if not dragged
  const positionStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'none',
        zIndex: 9999
      }
    : {
        position: 'fixed',
        top: 'max(14px, env(safe-area-inset-top, 14px))',
        left: isArabic ? 'max(14px, env(safe-area-inset-left, 14px))' : 'auto',
        right: !isArabic ? 'max(14px, env(safe-area-inset-right, 14px))' : 'auto',
        zIndex: 9999
      };

  return (
    <div style={positionStyle} className="touch-none select-none">
      {/* 1. COMPACT FLOATING PILL */}
      <div
        ref={pillRef}
        onPointerDown={handlePointerDown}
        onClick={handlePillClick}
        title={isArabic ? 'انقر لعرض تفاصيل اتصال الشبكة' : 'Click to view Network Diagnostics'}
        className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-950/90 hover:bg-slate-900 active:scale-95 text-white font-mono text-[11px] font-bold shadow-lg shadow-black/40 border border-slate-700/80 backdrop-blur-md cursor-pointer transition-transform duration-100"
      >
        {/* Quality Dot with Ping pulse */}
        <span className="relative flex h-2 w-2 items-center justify-center">
          {metrics.connectionQuality !== 'offline' && metrics.connectionQuality !== 'unavailable' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentQualityInfo.dotClass.split(' ')[0]}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${currentQualityInfo.dotClass}`} />
        </span>

        {/* Latency Number or Offline Text */}
        <div className="flex items-center gap-1 leading-none tracking-tight">
          {metrics.status === 'offline' ? (
            <span className="text-rose-400 font-sans text-[10.5px] font-black">
              {isArabic ? 'غير متصل' : 'Offline'}
            </span>
          ) : metrics.currentPing !== null ? (
            <>
              <span className="font-extrabold text-slate-100">{metrics.currentPing}</span>
              <span className="text-[9.5px] text-slate-400 font-sans">ms</span>
              {metrics.connectionQuality === 'poor' && (
                <span className="text-[9.5px] text-rose-400 font-sans font-bold ml-0.5">
                  {isArabic ? 'ضعيف' : 'Poor'}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400 font-sans text-[10.5px]">● — ms</span>
          )}
        </div>
      </div>

      {/* 2. MINI POPOVER DETAILS */}
      <AnimatePresence>
        {showPopover && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.94, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 4 }}
            transition={{ duration: 0.12 }}
            className={`absolute top-full mt-2 ${
              isArabic ? 'left-0' : 'right-0'
            } w-64 bg-slate-900/98 text-white rounded-xl shadow-2xl border border-slate-700/90 p-3 backdrop-blur-xl z-[10000] font-sans text-xs space-y-2.5`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>{isArabic ? 'جودة الشبكة المباشرة' : 'Network Diagnostics'}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => networkMonitorService.pingNow()}
                  title={isArabic ? 'إعادة الفحص الآن' : 'Test Ping Now'}
                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPopover(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] font-sans text-slate-400 block mb-0.5">
                  {isArabic ? 'الاستجابة الحالية' : 'Current Ping'}
                </span>
                <span className="text-sm font-extrabold text-white">
                  {metrics.currentPing !== null ? `${metrics.currentPing} ms` : '—'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-[10px] font-sans text-slate-400 block mb-0.5">
                  {isArabic ? 'متوسط الحصة' : 'Average'}
                </span>
                <span className="text-sm font-extrabold text-slate-200">
                  {metrics.averagePing !== null ? `${metrics.averagePing} ms` : '—'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-sans text-slate-400 block mb-0.5">
                    {isArabic ? 'الأقل (Min)' : 'Min'}
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {metrics.minPing !== null ? `${metrics.minPing} ms` : '—'}
                  </span>
                </div>
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400/70" />
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-sans text-slate-400 block mb-0.5">
                    {isArabic ? 'الأعلى (Max)' : 'Max'}
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    {metrics.maxPing !== null ? `${metrics.maxPing} ms` : '—'}
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400/70" />
              </div>
            </div>

            {/* Quality & Status Row */}
            <div className="space-y-1.5 pt-1 text-[11px]">
              <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                <span className="text-slate-400">{isArabic ? 'تقييم الجودة' : 'Quality'}:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${currentQualityInfo.badgeClass}`}>
                  {isArabic ? currentQualityInfo.labelAr : currentQualityInfo.labelEn}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                <span className="text-slate-400">{isArabic ? 'حالة الاتصال' : 'Status'}:</span>
                <span className="font-bold flex items-center gap-1">
                  {metrics.status === 'online' ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">{isArabic ? 'متصل' : 'Online'}</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-rose-400" />
                      <span className="text-rose-400">{isArabic ? 'غير متصل' : 'Offline'}</span>
                    </>
                  )}
                </span>
              </div>

              {metrics.effectiveType && (
                <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                  <span className="text-slate-400">{isArabic ? 'نوع الشبكة' : 'Network Type'}:</span>
                  <span className="font-mono font-bold text-slate-300">
                    {metrics.effectiveType} {metrics.downlink ? `• ${metrics.downlink} Mbps` : ''}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between py-1 border-t border-slate-800/60 text-[10px] text-slate-400 font-mono">
                <span>{isArabic ? 'آخر فحص' : 'Last check'}:</span>
                <span>{metrics.lastCheckedAt || '—'}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-slate-800/60 text-[10px] text-slate-400 font-mono">
                <span>{isArabic ? 'الفحوصات الفاشلة' : 'Failed checks'}:</span>
                <span className={metrics.failedChecks > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {metrics.failedChecks}
                </span>
              </div>
            </div>

            {/* Helpful tip footer */}
            <div className="text-[9.5px] text-slate-500 text-center pt-1 border-t border-slate-800/80">
              {isArabic ? 'يتم التحديث كل ثانية خلال الحصة النشطة' : 'Live updates 1x/sec during active session'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

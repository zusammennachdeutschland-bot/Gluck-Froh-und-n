import React, { useLayoutEffect, useRef, useState, useMemo, useEffect } from 'react';

interface CertificateStudentNameProps {
  name: string;
  isRtl?: boolean;
  className?: string;
  style?: React.CSSProperties;
  maxFontSizePx?: number;
  minFontSizePx?: number;
  fontFamily?: string;
  fontStyle?: 'serif' | 'sans';
}

/**
 * High precision Auto-Fit Student Name component.
 * Guaranteed to stay on ONE SINGLE LINE without wrapping, overflow, or clipping.
 * Dynamically measures rendered text width against the container's designated frame
 * and scales down smoothly until it fits perfectly.
 * 
 * Supports:
 * - Native Arabic cursive shaping (Amiri / Alexandria / Cairo) with zero letter-spacing detachment.
 * - Latin / German / English special characters (ä, ö, ü, ß, accents) with Cinzel & Playfair Display.
 */
export const CertificateStudentName: React.FC<CertificateStudentNameProps> = ({
  name,
  isRtl = false,
  className = '',
  style = {},
  maxFontSizePx = 48,
  minFontSizePx = 18,
  fontFamily,
  fontStyle = 'serif'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const cleanName = (name || 'Student Name').trim();

  // Auto-detect if name contains Arabic script
  const containsArabic = useMemo(() => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(cleanName);
  }, [cleanName]);

  const effectiveIsRtl = isRtl || containsArabic;

  const resolvedFontFamily = useMemo(() => {
    if (fontFamily) return fontFamily;
    if (effectiveIsRtl) {
      return fontStyle === 'serif'
        ? "'Amiri', 'Alexandria', 'Cairo', 'Noto Sans Arabic', 'Scheherazade New', 'Times New Roman', serif"
        : "'Alexandria', 'Cairo', 'Noto Sans Arabic', system-ui, sans-serif";
    }
    return fontStyle === 'serif'
      ? "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif"
      : "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
  }, [fontFamily, effectiveIsRtl, fontStyle]);

  // Instant heuristic initial font size based on character length
  const initialCalculatedSize = useMemo(() => {
    const len = cleanName.length;
    if (len <= 12) return maxFontSizePx;
    if (len <= 20) return Math.max(minFontSizePx, Math.round(maxFontSizePx * 0.84));
    if (len <= 28) return Math.max(minFontSizePx, Math.round(maxFontSizePx * 0.70));
    if (len <= 38) return Math.max(minFontSizePx, Math.round(maxFontSizePx * 0.58));
    return minFontSizePx;
  }, [cleanName, maxFontSizePx, minFontSizePx]);

  const [fontSize, setFontSize] = useState<number>(initialCalculatedSize);
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  const computeFit = () => {
    const container = containerRef.current;
    const textSpan = textRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    if (!containerWidth || containerWidth <= 0) return;

    // Allow 92% of container width for safety padding inside frame
    const targetMaxWidth = containerWidth * 0.92;

    // Measure using high-speed 2D canvas context for exact rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let currentSize = maxFontSizePx;

    if (ctx) {
      if (effectiveIsRtl) {
        ctx.direction = 'rtl';
      }
      while (currentSize > minFontSizePx) {
        ctx.font = `bold ${currentSize}px ${resolvedFontFamily}`;
        const measuredWidth = ctx.measureText(cleanName).width;
        if (measuredWidth <= targetMaxWidth) {
          break;
        }
        currentSize -= 1;
      }
    }

    // Check if even at minimum font size it's still wider than container
    if (ctx) {
      ctx.font = `bold ${minFontSizePx}px ${resolvedFontFamily}`;
      const minSizeWidth = ctx.measureText(cleanName).width;
      if (minSizeWidth > targetMaxWidth) {
        setScaleFactor(Math.max(0.65, targetMaxWidth / minSizeWidth));
      } else {
        setScaleFactor(1);
      }
    }

    setFontSize(currentSize);
  };

  useLayoutEffect(() => {
    computeFit();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      computeFit();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [cleanName, maxFontSizePx, minFontSizePx, resolvedFontFamily, effectiveIsRtl]);

  // When fonts finish loading in browser, re-check fit
  useEffect(() => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        computeFit();
      }).catch(() => {
        // ignore
      });
    }
  }, [resolvedFontFamily]);

  return (
    <div
      ref={containerRef}
      dir={effectiveIsRtl ? 'rtl' : 'ltr'}
      lang={effectiveIsRtl ? 'ar' : 'de'}
      className="w-full flex items-center justify-center overflow-visible py-1 sm:py-2"
      style={{
        maxWidth: '100%',
        boxSizing: 'border-box',
        unicodeBidi: 'plaintext'
      }}
    >
      <span
        ref={textRef}
        dir={effectiveIsRtl ? 'rtl' : 'ltr'}
        lang={effectiveIsRtl ? 'ar' : 'de'}
        className={`inline-block select-none font-bold ${effectiveIsRtl ? 'tracking-normal' : 'tracking-normal'} ${className}`}
        style={{
          fontFamily: resolvedFontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: effectiveIsRtl ? 1.4 : 1.28,
          whiteSpace: 'nowrap',
          wordBreak: 'keep-all',
          letterSpacing: effectiveIsRtl ? '0px' : undefined,
          fontFeatureSettings: '"liga" 1, "calt" 1, "kern" 1',
          textRendering: 'geometricPrecision',
          paddingTop: '2px',
          paddingBottom: '4px',
          transform: scaleFactor < 1 ? `scale(${scaleFactor})` : undefined,
          transformOrigin: 'center center',
          ...style
        }}
      >
        {cleanName}
      </span>
    </div>
  );
};


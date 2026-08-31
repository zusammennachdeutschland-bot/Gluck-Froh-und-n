// Unregister any active service workers on startup to prevent stale asset caching
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch((err) => {
    console.warn('Service worker unregistration failed:', err);
  });
}

// Global safety shim: Protect CanvasGradient against non-finite values (e.g. from html2canvas parsing CSS gradients)
if (typeof window !== 'undefined') {
  if (typeof CanvasGradient !== 'undefined' && CanvasGradient.prototype) {
    const cgProto = CanvasGradient.prototype as any;
    if (!cgProto._safeAddColorStopPatched) {
      const origAddColorStop = cgProto.addColorStop;
      cgProto.addColorStop = function (offset: number, color: string) {
        let safeOffset = offset;
        if (typeof safeOffset !== 'number' || !Number.isFinite(safeOffset) || Number.isNaN(safeOffset)) {
          safeOffset = 0;
        } else if (safeOffset < 0) {
          safeOffset = 0;
        } else if (safeOffset > 1) {
          safeOffset = 1;
        }
        try {
          return origAddColorStop.call(this, safeOffset, color);
        } catch {
          try {
            return origAddColorStop.call(this, safeOffset, 'rgba(0,0,0,0)');
          } catch {
            // Ignore non-recoverable error
          }
        }
      };
      cgProto._safeAddColorStopPatched = true;
    }
  }

  if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype) {
    const ctxProto = CanvasRenderingContext2D.prototype as any;
    if (!ctxProto._safeCanvasGradientPatched) {
      const origLinear = ctxProto.createLinearGradient;
      ctxProto.createLinearGradient = function (x0: number, y0: number, x1: number, y1: number) {
        const safeX0 = Number.isFinite(x0) ? x0 : 0;
        const safeY0 = Number.isFinite(y0) ? y0 : 0;
        const safeX1 = Number.isFinite(x1) ? x1 : 0;
        const safeY1 = Number.isFinite(y1) ? y1 : 0;
        return origLinear.call(this, safeX0, safeY0, safeX1, safeY1);
      };

      const origRadial = ctxProto.createRadialGradient;
      ctxProto.createRadialGradient = function (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
        const safeX0 = Number.isFinite(x0) ? x0 : 0;
        const safeY0 = Number.isFinite(y0) ? y0 : 0;
        const safeR0 = Number.isFinite(r0) ? Math.max(0, r0) : 0;
        const safeX1 = Number.isFinite(x1) ? x1 : 0;
        const safeY1 = Number.isFinite(y1) ? y1 : 0;
        const safeR1 = Number.isFinite(r1) ? Math.max(0, r1) : 0;
        return origRadial.call(this, safeX0, safeY0, safeR0, safeX1, safeY1, safeR1);
      };
      ctxProto._safeCanvasGradientPatched = true;
    }
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

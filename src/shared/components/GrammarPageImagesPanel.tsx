import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GrammarPageImageRef } from '../../types/lernstudio';
import {
  StoredPageImageRecord,
  exportPageImagesBundle,
  importPageImagesBundle,
  loadPageImagesByIds
} from '../lernstudioPageImageStore';
import { Camera, Download, ImageOff, Upload } from 'lucide-react';

interface Props {
  pageImageRefs?: GrammarPageImageRef[];
  language?: string;
  title?: string;
}

export const GrammarPageImagesPanel: React.FC<Props> = ({
  pageImageRefs = [],
  language = 'ar',
  title
}) => {
  const isRtl = language === 'ar';
  const [loadedMap, setLoadedMap] = useState<Map<string, StoredPageImageRecord>>(new Map());
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refs = Array.isArray(pageImageRefs) ? pageImageRefs : [];

  const refreshLoadedImages = useCallback(async () => {
    const ids = refs.map((r) => r.id || r.localStorageKey || '').filter(Boolean);
    if (ids.length === 0) {
      setLoadedMap(new Map());
      return;
    }
    const records = await loadPageImagesByIds(ids);
    const nextMap = new Map<string, StoredPageImageRecord>();
    for (const rec of records) {
      nextMap.set(rec.id, rec);
    }
    setLoadedMap(nextMap);
  }, [refs.map((r) => r.id).join('|')]);

  useEffect(() => {
    void refreshLoadedImages();
  }, [refreshLoadedImages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSynced = () => {
      void refreshLoadedImages();
    };
    window.addEventListener('glueck-page-images-synced', onSynced);
    return () => window.removeEventListener('glueck-page-images-synced', onSynced);
  }, [refreshLoadedImages]);

  if (refs.length === 0) return null;

  const availableIds = refs.map((r) => r.id).filter((id) => loadedMap.has(id));
  const missingCount = refs.length - availableIds.length;

  const handleExportBundle = async () => {
    if (availableIds.length === 0 || busy) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const bundle = await exportPageImagesBundle(availableIds);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glueck-grammar-pages-${Date.now()}.glueck-pages.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg(
        isRtl
          ? `تم تصدير ${bundle.images.length} صورة في ملف .glueck-pages.json`
          : `Exported ${bundle.images.length} page image(s).`
      );
    } catch (err: any) {
      setStatusMsg(err?.message || (isRtl ? 'فشل تصدير حزمة الصور.' : 'Failed to export page bundle.'));
    } finally {
      setBusy(false);
    }
  };

  const handleImportBundle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setStatusMsg(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const res = await importPageImagesBundle(String(evt.target?.result || ''));
        await refreshLoadedImages();
        setStatusMsg(
          isRtl
            ? `تم استيراد ${res.importedCount} صورة (تم تخطي ${res.skippedDuplicates} مكررة${res.invalidCount ? ` · ${res.invalidCount} غير صالحة` : ''})`
            : `Imported ${res.importedCount} image(s) (${res.skippedDuplicates} duplicates skipped).`
        );
      } catch (err: any) {
        setStatusMsg(err?.message || (isRtl ? 'ملف حزمة الصور غير صالح.' : 'Invalid page images bundle.'));
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-3 rounded-xl bg-surface-hover/60 border border-surface-border space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-black text-text-main inline-flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-primary" />
          <span>
            {title ||
              (isRtl
                ? `صور صفحات الكتاب المرفقة (${refs.length})`
                : `Attached Textbook Pages (${refs.length})`)}
          </span>
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {availableIds.length > 0 && (
            <button
              type="button"
              onClick={handleExportBundle}
              disabled={busy}
              className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-text-main hover:border-primary/40 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
            >
              <Download className="w-3 h-3 text-primary" />
              <span>{isRtl ? 'تصدير الصور (.glueck-pages.json)' : 'Export Pages'}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.glueck-pages.json"
            onChange={handleImportBundle}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            <span>{isRtl ? 'استيراد حزمة صور' : 'Import Pages Bundle'}</span>
          </button>
        </div>
      </div>

      {missingCount > 0 && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 font-medium">
          {isRtl
            ? `${missingCount} صورة غير متوفرة محلياً على هذا الجهاز حتى الآن (تمت إضافتها من جهاز آخر). تتم مزامنتها تلقائياً عبر P2P عند اتصال الأجهزة، أو يمكنك استيراد ملف .glueck-pages.json يدوياً.`
            : `${missingCount} textbook image(s) are not yet on this device. They sync automatically via P2P when paired devices connect, or you can import a .glueck-pages.json bundle.`}
        </p>
      )}

      {statusMsg && (
        <p className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">{statusMsg}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {refs
          .slice()
          .sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0))
          .map((ref, idx) => {
            const rec = loadedMap.get(ref.id) || (ref.localStorageKey ? loadedMap.get(ref.localStorageKey) : undefined);
            if (rec) {
              return (
                <div
                  key={ref.id || idx}
                  className="rounded-xl border border-surface-border bg-surface overflow-hidden p-1.5 space-y-1"
                >
                  <img
                    src={`data:${rec.mimeType || 'image/jpeg'};base64,${rec.base64Data}`}
                    alt={ref.fileName}
                    className="w-full h-24 object-cover rounded-lg border border-surface-border/60"
                  />
                  <div className="text-[10px] font-bold text-text-muted truncate px-0.5">
                    #{ref.pageOrder || idx + 1} {ref.fileName}
                  </div>
                </div>
              );
            }
            return (
              <div
                key={ref.id || idx}
                className="rounded-xl border border-dashed border-amber-500/40 bg-surface/60 p-2.5 flex flex-col items-center justify-center text-center gap-1 min-h-[110px]"
              >
                <ImageOff className="w-5 h-5 text-amber-500" />
                <span className="text-[10.5px] font-bold text-text-main truncate max-w-full">
                  #{ref.pageOrder || idx + 1} {ref.fileName}
                </span>
                <span className="text-[10px] text-text-muted">
                  {isRtl ? 'غير موجودة محلياً على هذا الجهاز' : 'Not stored on this device'}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
};

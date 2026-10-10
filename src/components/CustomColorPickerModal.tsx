import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Palette, Check, X, Star, Trash2, Sparkles, RefreshCw, Copy, CheckCheck } from 'lucide-react';
import { 
  hsvToRgb, 
  rgbToHsv, 
  rgbToHex, 
  hexToRgb, 
  applyAccentToDocument, 
  COLOR_FAMILIES 
} from '../utils/colorUtils';
import { useApp } from '../context/AppContext';

interface CustomColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccent: string;
  onSelectAccent: (colorHexOrKey: string) => void;
}

export const CustomColorPickerModal: React.FC<CustomColorPickerModalProps> = ({
  isOpen,
  onClose,
  currentAccent,
  onSelectAccent,
}) => {
  const { t, _t } = useApp();

  // Initial color conversion to HSV
  const initialHex = currentAccent.startsWith('#') 
    ? currentAccent 
    : currentAccent.startsWith('hex-') 
      ? `#${currentAccent.replace('hex-', '')}`
      : '#3b82f6';

  const initialRgb = hexToRgb(initialHex);
  const initialHsv = rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b);

  const [hue, setHue] = useState<number>(initialHsv.h);
  const [sat, setSat] = useState<number>(initialHsv.s);
  const [val, setVal] = useState<number>(initialHsv.v);

  const [hexInput, setHexInput] = useState<string>(initialHex);
  const [copied, setCopied] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dl_favorite_accent_colors');
      return saved ? JSON.parse(saved) : ['#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#f59e0b', '#06b6d4'];
    } catch {
      return ['#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#f59e0b', '#06b6d4'];
    }
  });

  const spectrumRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const isDraggingSpectrum = useRef(false);
  const isDraggingHue = useRef(false);

  // Derived current RGB & HEX
  const currentRgb = hsvToRgb(hue, sat, val);
  const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);

  // Sync inputs when HSV changes
  useEffect(() => {
    setHexInput(currentHex);
  }, [hue, sat, val, currentHex]);

  // When modal opens or currentAccent changes externally
  useEffect(() => {
    if (isOpen) {
      const hex = currentAccent.startsWith('#') 
        ? currentAccent 
        : currentAccent.startsWith('hex-')
          ? `#${currentAccent.replace('hex-', '')}`
          : '#3b82f6';
      const rgb = hexToRgb(hex);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
      setHexInput(hex);
    }
  }, [isOpen, currentAccent]);

  // Save favorites to localStorage
  const saveFavoritesToStorage = (favs: string[]) => {
    setFavorites(favs);
    try {
      localStorage.setItem('dl_favorite_accent_colors', JSON.stringify(favs));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFavorite = (hex: string) => {
    const formatted = hex.toLowerCase();
    if (favorites.some(f => f.toLowerCase() === formatted)) {
      saveFavoritesToStorage(favorites.filter(f => f.toLowerCase() !== formatted));
    } else {
      saveFavoritesToStorage([hex, ...favorites.slice(0, 15)]);
    }
  };

  // Spectrum 2D drag handlers
  const handleSpectrumMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!spectrumRef.current) return;
    const rect = spectrumRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const newSat = Math.round((x / rect.width) * 100);
    const newVal = Math.round((1 - y / rect.height) * 100);

    setSat(newSat);
    setVal(newVal);

    // Live instant preview across app
    const rgb = hsvToRgb(hue, newSat, newVal);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    applyAccentToDocument(hex);
    onSelectAccent(hex);
  }, [hue, onSelectAccent]);

  // Hue Slider drag handlers
  const handleHueMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const newHue = Math.round((x / rect.width) * 360);

    setHue(newHue);

    // Live instant preview across app
    const rgb = hsvToRgb(newHue, sat, val);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    applyAccentToDocument(hex);
    onSelectAccent(hex);
  }, [sat, val, onSelectAccent]);

  // Global Pointer Listeners
  useEffect(() => {
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (isDraggingSpectrum.current) handleSpectrumMove(e);
      if (isDraggingHue.current) handleHueMove(e);
    };

    const onPointerUp = () => {
      isDraggingSpectrum.current = false;
      isDraggingHue.current = false;
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [handleSpectrumMove, handleHueMove]);

  // Handle manual HEX input
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setHexInput(valStr);
    let cleaned = valStr.trim();
    if (!cleaned.startsWith('#')) cleaned = `#${cleaned}`;

    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      const rgb = hexToRgb(cleaned);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
      applyAccentToDocument(cleaned);
      onSelectAccent(cleaned);
    }
  };

  // Handle RGB inputs
  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const clamped = Math.max(0, Math.min(255, value || 0));
    const newRgb = { ...currentRgb, [channel]: clamped };
    const hsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    applyAccentToDocument(hex);
    onSelectAccent(hex);
  };

  const handleCopyHex = () => {
    navigator.clipboard.writeText(currentHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isFavorited = favorites.some(f => f.toLowerCase() === currentHex.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="bg-surface border border-surface-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-surface-border flex items-center justify-between bg-surface-hover/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-1.5">
                {_t('منتقي الألوان الاحترافي', 'Professional Color Picker', 'Profi-Farbauswahl')}
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-text-muted">
                {_t('اختر أي درجة لون وخصص مظهر التطبيق بالكامل', 'Choose any shade & customize the app theme', 'Farbe wählen & App anpassen')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-border text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* 2D Color Spectrum Box */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-text-muted">
              <span>{_t('مساحة التشبع والسطوع (2D Spectrum)', '2D Saturation & Brightness', 'Sättigung & Helligkeit')}</span>
              <span className="font-mono text-primary font-bold">{currentHex.toUpperCase()}</span>
            </div>
            <div
              ref={spectrumRef}
              onMouseDown={(e) => {
                isDraggingSpectrum.current = true;
                handleSpectrumMove(e.nativeEvent);
              }}
              onTouchStart={(e) => {
                isDraggingSpectrum.current = true;
                handleSpectrumMove(e.nativeEvent);
              }}
              className="relative w-full h-44 sm:h-52 rounded-xl cursor-crosshair overflow-hidden select-none shadow-inner border border-white/10"
              style={{
                backgroundColor: `hsl(${hue}, 100%, 50%)`,
                backgroundImage: `
                  linear-gradient(to top, #000, transparent),
                  linear-gradient(to right, #fff, transparent)
                `
              }}
            >
              {/* Target Pointer Crosshair */}
              <div
                className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white shadow-md pointer-events-none transform transition-transform duration-75 scale-110"
                style={{
                  left: `${sat}%`,
                  top: `${100 - val}%`,
                  backgroundColor: currentHex,
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)'
                }}
              />
            </div>
          </div>

          {/* Hue Slider Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-text-muted">
              <span>{_t('شريط درجة اللون (Hue Slider)', 'Hue Spectrum Slider', 'Farbton-Regler')}</span>
              <span className="font-mono">{hue}°</span>
            </div>
            <div
              ref={hueRef}
              onMouseDown={(e) => {
                isDraggingHue.current = true;
                handleHueMove(e.nativeEvent);
              }}
              onTouchStart={(e) => {
                isDraggingHue.current = true;
                handleHueMove(e.nativeEvent);
              }}
              className="relative w-full h-6 rounded-lg cursor-pointer overflow-hidden select-none border border-white/10 shadow-inner"
              style={{
                background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
              }}
            >
              {/* Slider Thumb */}
              <div
                className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-white border-2 border-slate-900 rounded-md shadow-md pointer-events-none"
                style={{ left: `${(hue / 360) * 100}%` }}
              />
            </div>
          </div>

          {/* Color Preview & HEX/RGB Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-hover/40 p-3 rounded-xl border border-surface-border">
            
            {/* Live Color Circle & Save Favorite */}
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-xl shadow-lg border-2 border-white/30 shrink-0 flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: currentHex }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/20 pointer-events-none" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm font-black text-text-main">{currentHex.toUpperCase()}</span>
                  <button
                    type="button"
                    onClick={handleCopyHex}
                    className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-main transition-colors"
                    title={_t('نسخ كود اللون', 'Copy HEX Code', 'HEX-Code kopieren')}
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(currentHex)}
                  className={`flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                    isFavorited 
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                      : 'bg-surface hover:bg-surface-border text-text-muted'
                  }`}
                >
                  <Star className={`w-3 h-3 ${isFavorited ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>{isFavorited ? _t('في المفضلة', 'Favorited', 'In Favoriten') : _t('إضافة للمفضلة', 'Save to Favorites', 'Zu Favoriten')}</span>
                </button>
              </div>
            </div>

            {/* Inputs: HEX and RGB */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase text-text-muted w-10">HEX:</label>
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  placeholder="#3B82F6"
                  maxLength={7}
                  className="flex-1 bg-surface border border-surface-border rounded-lg px-2.5 py-1 font-mono text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary uppercase font-bold"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold uppercase text-text-muted w-10">RGB:</label>
                <div className="flex gap-1 flex-1">
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={currentRgb.r}
                    onChange={(e) => handleRgbChange('r', parseInt(e.target.value))}
                    className="w-full bg-surface border border-surface-border rounded-md px-1.5 py-0.5 font-mono text-[11px] text-center text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={currentRgb.g}
                    onChange={(e) => handleRgbChange('g', parseInt(e.target.value))}
                    className="w-full bg-surface border border-surface-border rounded-md px-1.5 py-0.5 font-mono text-[11px] text-center text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={currentRgb.b}
                    onChange={(e) => handleRgbChange('b', parseInt(e.target.value))}
                    className="w-full bg-surface border border-surface-border rounded-md px-1.5 py-0.5 font-mono text-[11px] text-center text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Saved Favorites Section */}
          {favorites.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  {_t('الألوان المفضلة المحفوظة', 'Saved Favorite Colors', 'Gespeicherte Lieblingsfarben')}
                </span>
                <span className="text-[10px] font-normal">{favorites.length} {_t('لون', 'colors', 'Farben')}</span>
              </div>
              <div className="flex flex-wrap gap-2 p-2 bg-surface rounded-xl border border-surface-border">
                {favorites.map((favHex) => {
                  const isSelected = favHex.toLowerCase() === currentHex.toLowerCase();
                  return (
                    <div key={favHex} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          const rgb = hexToRgb(favHex);
                          const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                          setHue(hsv.h);
                          setSat(hsv.s);
                          setVal(hsv.v);
                          applyAccentToDocument(favHex);
                          onSelectAccent(favHex);
                        }}
                        className={`w-7 h-7 rounded-full shadow-sm flex items-center justify-center transition-all cursor-pointer ${
                          isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: favHex }}
                        title={favHex}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow stroke-[3]" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(favHex);
                        }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] cursor-pointer"
                        title={_t('حذف', 'Remove', 'Löschen')}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Preset Shades Shortcuts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-text-muted block">
              {_t('نماذج سريعة شائعة', 'Popular Quick Presets', 'Beliebte Voreinstellungen')}
            </span>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {[
                '#3b82f6', '#1d4ed8', '#10b981', '#15803d', '#8b5cf6', '#6b21a8',
                '#ec4899', '#be123c', '#ef4444', '#f97316', '#f59e0b', '#06b6d4'
              ].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    const rgb = hexToRgb(hex);
                    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                    setHue(hsv.h);
                    setSat(hsv.s);
                    setVal(hsv.v);
                    applyAccentToDocument(hex);
                    onSelectAccent(hex);
                  }}
                  className={`w-full aspect-square rounded-lg transition-transform cursor-pointer border border-black/10 shadow-2xs hover:scale-110 ${
                    currentHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-offset-1 ring-primary scale-105' : ''
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-surface-border bg-surface-hover/40 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              // Reset to classic blue
              const defaultHex = '#3b82f6';
              const rgb = hexToRgb(defaultHex);
              const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
              setHue(hsv.h);
              setSat(hsv.s);
              setVal(hsv.v);
              applyAccentToDocument('blue');
              onSelectAccent('blue');
            }}
            className="flex items-center gap-1 text-[11px] font-bold text-text-muted hover:text-text-main px-2.5 py-1.5 rounded-lg hover:bg-surface border border-surface-border transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{_t('استعادة الافتراضي', 'Reset Default', 'Standard zurücksetzen')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              applyAccentToDocument(currentHex);
              onSelectAccent(currentHex);
              onClose();
            }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-primary/20 transition-all active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{_t('تطبيق وحفظ اللون ✨', 'Apply & Save Color ✨', 'Farbe anwenden ✨')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

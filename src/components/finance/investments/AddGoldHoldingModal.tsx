import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Sparkles, AlertCircle, Calendar, Hash, Tag, FileText, Check } from 'lucide-react';
import { GoldHolding, getPurityKaratNumber, getPurityFactor } from '../../../services/goldPrice/goldPriceTypes';

interface AddGoldHoldingModalProps {
  onClose: () => void;
  existingHolding?: GoldHolding;
}

const COMMON_BRANDS = ['BTC', 'Master Gold', 'Lazurde', 'SAM', 'Egypt Mint', 'Swiss Gold'];
const PURITY_PRESETS = [
  { label: '24K', karat: 24, hint: '100% (نقي)' },
  { label: '22K', karat: 22, hint: '91.7%' },
  { label: '21K', karat: 21, hint: '87.5% (شائع)' },
  { label: '18K', karat: 18, hint: '75.0%' },
  { label: '14K', karat: 14, hint: '58.3%' },
];

export const AddGoldHoldingModal: React.FC<AddGoldHoldingModalProps> = ({ onClose, existingHolding }) => {
  const { _t, addGoldHolding, updateGoldHolding, latestGoldPrice } = useApp();

  const [brand, setBrand] = useState(existingHolding?.brand || 'BTC');
  const [customBrand, setCustomBrand] = useState('');
  const [isCustomBrand, setIsCustomBrand] = useState(!COMMON_BRANDS.includes(existingHolding?.brand || 'BTC'));

  const [purity, setPurity] = useState(existingHolding?.purity || '24K');
  const [weightGrams, setWeightGrams] = useState(existingHolding?.weightGrams?.toString() || '');
  
  // Format purchase date as YYYY-MM-DD
  const [purchaseDate, setPurchaseDate] = useState(() => {
    if (existingHolding?.purchaseDate) {
      return existingHolding.purchaseDate.split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });

  const [purchasePrice, setPurchasePrice] = useState(existingHolding?.purchasePrice?.toString() || '');
  const [purchasePricePerGram, setPurchasePricePerGram] = useState(existingHolding?.purchasePricePerGram?.toString() || '');
  const [notes, setNotes] = useState(existingHolding?.notes || '');
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate total price or price per gram on weight change
  const handleWeightChange = (newWeightStr: string) => {
    setWeightGrams(newWeightStr);
    const w = parseFloat(newWeightStr);
    const ppg = parseFloat(purchasePricePerGram);
    if (!isNaN(w) && w > 0 && !isNaN(ppg) && ppg > 0) {
      setPurchasePrice(Math.round(w * ppg).toString());
    } else if (!isNaN(w) && w > 0 && !purchasePrice && latestGoldPrice?.pricePerGram24K) {
      // Suggest from live price if available
      const karat = getPurityKaratNumber(purity);
      const estPpg = Math.round(latestGoldPrice.pricePerGram24K * (karat / 24));
      setPurchasePricePerGram(estPpg.toString());
      setPurchasePrice(Math.round(w * estPpg).toString());
    }
  };

  const handlePriceChange = (newPriceStr: string) => {
    setPurchasePrice(newPriceStr);
    const p = parseFloat(newPriceStr);
    const w = parseFloat(weightGrams);
    if (!isNaN(p) && p > 0 && !isNaN(w) && w > 0) {
      setPurchasePricePerGram(Math.round((p / w) * 100) / 100 + '');
    }
  };

  const handlePricePerGramChange = (newPpgStr: string) => {
    setPurchasePricePerGram(newPpgStr);
    const ppg = parseFloat(newPpgStr);
    const w = parseFloat(weightGrams);
    if (!isNaN(ppg) && ppg > 0 && !isNaN(w) && w > 0) {
      setPurchasePrice(Math.round(w * ppg).toString());
    }
  };

  const handlePurityChange = (newPurity: string) => {
    setPurity(newPurity);
    // If we have live price and weight, offer smart suggestion
    const w = parseFloat(weightGrams);
    if (!purchasePrice && !purchasePricePerGram && latestGoldPrice?.pricePerGram24K && w > 0) {
      const factor = getPurityFactor(newPurity);
      const estPpg = Math.round(latestGoldPrice.pricePerGram24K * factor);
      setPurchasePricePerGram(estPpg.toString());
      setPurchasePrice(Math.round(w * estPpg).toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const effectiveBrand = isCustomBrand ? customBrand.trim() : brand;
    if (!effectiveBrand) {
      setError(_t('يرجى تحديد أو إدخال اسم الشركة / الماركة', 'Please select or enter the brand name', 'Bitte Marke angeben'));
      return;
    }

    const weightNum = parseFloat(weightGrams);
    if (isNaN(weightNum) || weightNum <= 0) {
      setError(_t('يرجى إدخال وزن صحيح بالجرام أكبر من 0', 'Please enter a valid weight in grams greater than 0', 'Ungültiges Gewicht'));
      return;
    }

    const priceNum = parseFloat(purchasePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError(_t('يرجى إدخال سعر شراء صحيح', 'Please enter a valid purchase price', 'Ungültiger Kaufpreis'));
      return;
    }

    const ppgNum = parseFloat(purchasePricePerGram) || (weightNum > 0 ? Math.round((priceNum / weightNum) * 100) / 100 : 0);
    const karatNum = getPurityKaratNumber(purity);

    if (karatNum < 1 || karatNum > 24) {
      setError(_t('العيار يجب أن يكون بين 1 و 24', 'Purity karat must be between 1 and 24', 'Karat muss zwischen 1 und 24 liegen'));
      return;
    }

    if (existingHolding) {
      updateGoldHolding(existingHolding.id, {
        brand: effectiveBrand,
        purity,
        purityKarat: karatNum,
        weightGrams: weightNum,
        purchaseDate,
        purchasePrice: priceNum,
        purchasePricePerGram: ppgNum,
        currency: 'EGP',
        notes: notes.trim() || undefined,
      });
    } else {
      addGoldHolding({
        brand: effectiveBrand,
        purity,
        purityKarat: karatNum,
        weightGrams: weightNum,
        purchaseDate,
        purchasePrice: priceNum,
        purchasePricePerGram: ppgNum,
        currency: 'EGP',
        notes: notes.trim() || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-text-main">
                {existingHolding
                  ? _t('تعديل حيازة الذهب', 'Edit Gold Holding', 'Goldposition bearbeiten')
                  : _t('إضافة حيازة ذهب جديدة', 'Add New Gold Holding', 'Neue Goldposition hinzufügen')}
              </h3>
              <p className="text-[11px] text-text-muted">
                {_t('سبيكة أو عملة أو كسر ذهب في محفظتك الاستثمارية', 'Gold bar, coin or scrap in your portfolio', 'Goldbarren oder Münze')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Brand Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-500" />
              {_t('الشركة / الماركة', 'Brand / Manufacturer', 'Marke / Prägung')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_BRANDS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBrand(b);
                    setIsCustomBrand(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    !isCustomBrand && brand === b
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                  }`}
                >
                  {b}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomBrand(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  isCustomBrand
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                }`}
              >
                {_t('أخرى / مخصص', 'Other / Custom', 'Andere')}
              </button>
            </div>
            {isCustomBrand && (
              <input
                type="text"
                value={customBrand}
                onChange={e => setCustomBrand(e.target.value)}
                placeholder={_t('اكتب اسم الماركة أو المصنع...', 'Enter brand name...', 'Markenname eingeben...')}
                className="w-full mt-2 px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            )}
          </div>

          {/* 2. Purity Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>{_t('العيار / النقاوة', 'Purity / Karat', 'Feingehalt')}</span>
              <span className="text-[10px] text-text-muted">
                {_t('معامل السعر:', 'Factor:', 'Faktor:')} {(getPurityFactor(purity) * 100).toFixed(1)}%
              </span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {PURITY_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePurityChange(p.label)}
                  className={`py-2 px-1 rounded-xl text-center transition cursor-pointer border flex flex-col items-center justify-center ${
                    purity === p.label
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-surface-hover border-surface-border text-text-muted hover:text-text-main'
                  }`}
                >
                  <span className="text-xs font-black">{p.label}</span>
                  <span className={`text-[9px] ${purity === p.label ? 'text-amber-100' : 'text-text-muted'}`}>{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Weight and Purchase Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-main flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-amber-500" />
                {_t('الوزن بالجرام', 'Weight in Grams', 'Gewicht (Gramm)')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={weightGrams}
                  onChange={e => handleWeightChange(e.target.value)}
                  placeholder="5.00"
                  required
                  className="w-full px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
                <span className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted pointer-events-none">
                  {_t('جرام', 'g', 'g')}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-main flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted" />
                {_t('تاريخ الشراء', 'Purchase Date', 'Kaufdatum')}
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* 4. Purchase Price and Price Per Gram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-main">
                {_t('إجمالي سعر الشراء (ج.م)', 'Total Purchase Cost (EGP)', 'Gesamtkaufpreis')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={purchasePrice}
                  onChange={e => handlePriceChange(e.target.value)}
                  placeholder="35450"
                  required
                  className="w-full px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
                <span className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted pointer-events-none">
                  EGP
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-main flex items-center justify-between">
                <span>{_t('سعر الجرام وقت الشراء', 'Cost Per Gram', 'Preis pro Gramm')}</span>
                {latestGoldPrice && (
                  <button
                    type="button"
                    onClick={() => {
                      const karat = getPurityKaratNumber(purity);
                      const currentPpg = Math.round(latestGoldPrice.pricePerGram24K * (karat / 24));
                      handlePricePerGramChange(currentPpg.toString());
                    }}
                    className="text-[10px] text-amber-500 hover:underline cursor-pointer"
                  >
                    {_t('السعر الحالي', 'Use current', 'Aktueller')}
                  </button>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={purchasePricePerGram}
                  onChange={e => handlePricePerGramChange(e.target.value)}
                  placeholder="7090"
                  className="w-full px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-xs font-bold text-text-main focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
                <span className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted pointer-events-none">
                  EGP/g
                </span>
              </div>
            </div>
          </div>

          {/* 5. Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-main flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              {_t('ملاحظات إضافية (اختياري)', 'Notes (Optional)', 'Notizen')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={_t('مثال: سبيكة مغلفة برقم تسلسلي، فاتورة محل الصاغة...', 'e.g. Serialized bullion, invoice details...', 'z.B. Seriennummer')}
              className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-xl text-xs font-medium text-text-main focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition cursor-pointer"
            >
              {_t('إلغاء', 'Cancel', 'Abbrechen')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{existingHolding ? _t('حفظ التعديلات', 'Save Changes', 'Speichern') : _t('إضافة الحيازة', 'Add Holding', 'Hinzufügen')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

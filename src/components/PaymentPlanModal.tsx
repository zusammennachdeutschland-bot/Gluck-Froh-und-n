import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Student, PaymentPlanType } from '../types';
import { X, DollarSign, Check, Award, Layers, Save, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentPlanModalProps {
  student: Student;
  onClose: () => void;
}

export const PaymentPlanModal: React.FC<PaymentPlanModalProps> = ({ student, onClose }) => {
  const { updateStudentPaymentPlan, groups } = useApp();

  const currentGroup = groups.find(g => g.id === student.groupId);
  const defaultPrice = currentGroup?.pricePerSession || currentGroup?.monthlyPackagePrice || 200;

  const [plan, setPlan] = useState<PaymentPlanType>(student.paymentPlan || '4_lessons');
  const [pricePerLesson, setPricePerLesson] = useState<number>(student.pricePerLesson || defaultPrice);
  const [bundleSize, setBundleSize] = useState<number>(student.bundleSize || 4);
  const [customBundlePrice, setCustomBundlePrice] = useState<number>(student.customBundlePrice || (pricePerLesson * bundleSize));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateStudentPaymentPlan(
      student.id,
      plan,
      Number(pricePerLesson),
      Number(bundleSize),
      Number(customBundlePrice)
    );
    confetti({ particleCount: 50, spread: 40 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm: overflow-y-auto p-0 sm:p-4 pb-0">
      <div className="bg-surface border border-surface-border rounded-t-[28px] sm:rounded-xl pb-safe-bottom sm:pb-0 mb-0 w-full max-w-md shadow-2xl overflow-hidden animate-scale-up space-y-0 font-sans">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary via-primary to-primary-hover p-5 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-soft bg-surface/20 px-2.5 py-0.5 rounded-full">
              Zahlungsplan anpassen
            </span>
            <h3 className="text-base font-black mt-1 flex items-center gap-1.5">
              <DollarSign className="w-5 h-5 text-primary" />
              <span>Zahlungsplan für {student.name}</span>
            </h3>
            <p className="text-xs text-primary-soft">
              Lektionsbasierte Abrechnung & Paketvereinbarung.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-surface/20 rounded-full text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Plan Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-text-main">
              Wählen Sie das Abrechnungsmodell:
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setPlan('per_lesson'); setBundleSize(1); }}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  plan === 'per_lesson'
                    ? 'bg-primary-soft dark:bg-primary-soft/60 border-primary font-extrabold text-primary-hover dark:text-primary/70 shadow-xs'
                    : 'bg-surface-hover border-surface-border dark:border-surface-border-soft text-text-muted'
                }`}
              >
                <div className="font-bold">Pro Einzel-Lektion</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Zahlung nach jeder Lektion</div>
              </button>

              <button
                type="button"
                onClick={() => { setPlan('4_lessons'); setBundleSize(4); }}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  plan === '4_lessons'
                    ? 'bg-primary-soft dark:bg-primary-soft/60 border-primary font-extrabold text-primary-hover dark:text-primary/70 shadow-xs'
                    : 'bg-surface-hover border-surface-border dark:border-surface-border-soft text-text-muted'
                }`}
              >
                <div className="font-bold">4er Lektionspaket</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Abrechnung alle 4 Lektionen</div>
              </button>

              <button
                type="button"
                onClick={() => { setPlan('8_lessons'); setBundleSize(8); }}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  plan === '8_lessons'
                    ? 'bg-primary-soft dark:bg-primary-soft/60 border-primary font-extrabold text-primary-hover dark:text-primary/70 shadow-xs'
                    : 'bg-surface-hover border-surface-border dark:border-surface-border-soft text-text-muted'
                }`}
              >
                <div className="font-bold">8er Paket (Monatlich)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">2 Lektionen pro Woche</div>
              </button>

              <button
                type="button"
                onClick={() => { setPlan('12_lessons'); setBundleSize(12); }}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  plan === '12_lessons'
                    ? 'bg-primary-soft dark:bg-primary-soft/60 border-primary font-extrabold text-primary-hover dark:text-primary/70 shadow-xs'
                    : 'bg-surface-hover border-surface-border dark:border-surface-border-soft text-text-muted'
                }`}
              >
                <div className="font-bold">12er Paket (Quartal)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Großpaket mit Rabatt</div>
              </button>
            </div>
          </div>

          {/* Pricing Details */}
          <div className="bg-surface-hover/60 p-3.5 rounded-lg border border-surface-border dark:border-surface-border-soft space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Preis pro Einzel-Lektion (EGP)
                </label>
                <input
                  type="number"
                  value={pricePerLesson}
                  onChange={(e) => setPricePerLesson(Number(e.target.value))}
                  className="w-full p-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Anzahl Lektionen im Paket
                </label>
                <input
                  type="number"
                  value={bundleSize}
                  onChange={(e) => setBundleSize(Number(e.target.value))}
                  className="w-full p-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl font-bold font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                Gesamtpreis für Paket (EGP)
              </label>
              <input
                type="number"
                value={plan === 'custom_bundle' ? customBundlePrice : pricePerLesson * bundleSize}
                onChange={(e) => {
                  setPlan('custom_bundle');
                  setCustomBundlePrice(Number(e.target.value));
                }}
                className="w-full p-2 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl font-bold font-mono text-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 hover:shadow-lg hover:shadow-primary/30"
          >
            <Save className="w-4 h-4" />
            <span>Zahlungsplan Speichern</span>
          </button>
        </form>

      </div>
    </div>
  );
};

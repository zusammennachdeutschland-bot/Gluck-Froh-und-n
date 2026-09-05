import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { X, Save, Landmark, CreditCard, Wallet, Banknote, TrendingUp, RefreshCw, Palette, Building2, Check } from 'lucide-react';
import { FinanceAccount } from '../../../types';
import { BankCard, CARD_THEMES, getDefaultThemeForType } from '../BankCard';

interface AddFinanceAccountModalProps {
  onClose: () => void;
  existingAccount?: FinanceAccount;
}

export const AddFinanceAccountModal: React.FC<AddFinanceAccountModalProps> = ({ onClose, existingAccount }) => {
  const { _t, addFinanceAccount, updateFinanceAccount } = useApp();
  
  const [name, setName] = useState(existingAccount?.name || '');
  const [type, setType] = useState<FinanceAccount['type']>(existingAccount?.type || 'bank');
  const [currency, setCurrency] = useState(existingAccount?.currency || 'EGP');
  const [bankName, setBankName] = useState(existingAccount?.bankName || '');
  const [color, setColor] = useState<string>(existingAccount?.color || getDefaultThemeForType(existingAccount?.type || 'bank'));
  
  // Standard fields
  const [initialBalance, setInitialBalance] = useState(existingAccount?.initialBalance?.toString() || (existingAccount ? existingAccount.currentBalance.toString() : ''));
  const [accountNumber, setAccountNumber] = useState(existingAccount?.accountNumber || '');
  const [creditLimit, setCreditLimit] = useState(existingAccount?.creditLimit?.toString() || '');
  const [isActive, setIsActive] = useState(existingAccount?.isActive !== false);

  // Investment-specific fields
  const [annualReturnRate, setAnnualReturnRate] = useState(existingAccount?.annualInterestRate?.toString() || '');
  const [compoundingFrequency, setCompoundingFrequency] = useState<'daily' | 'monthly' | 'yearly'>(existingAccount?.compoundingFrequency || 'daily');
  const [reinvestReturns, setReinvestReturns] = useState(existingAccount?.reinvestReturns !== false);
  const [recurringContributionEnabled, setRecurringContributionEnabled] = useState(!!existingAccount?.recurringContributionAmount);
  const [recurringContributionAmount, setRecurringContributionAmount] = useState(existingAccount?.recurringContributionAmount?.toString() || '');
  const [recurringContributionFrequency, setRecurringContributionFrequency] = useState<'daily' | 'weekly' | 'monthly'>(existingAccount?.recurringContributionFrequency || 'monthly');
  const [nextContributionDate, setNextContributionDate] = useState(existingAccount?.nextContributionDate || new Date().toISOString().split('T')[0]);

  // When type changes and user hasn't explicitly customized color, suggest matching default
  const handleTypeChange = (newType: FinanceAccount['type']) => {
    setType(newType);
    if (!existingAccount) {
      setColor(getDefaultThemeForType(newType));
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    const balanceNum = parseFloat(initialBalance) || 0;
    const limitNum = parseFloat(creditLimit) || 0;
    const returnRateNum = parseFloat(annualReturnRate) || 0;
    const recAmountNum = parseFloat(recurringContributionAmount) || 0;

    const baseData = {
      name: name.trim(),
      type,
      currency,
      bankName: bankName.trim() || undefined,
      color,
      accountNumber: accountNumber.trim() || undefined,
      isActive
    };

    if (existingAccount) {
      updateFinanceAccount(existingAccount.id, {
        ...baseData,
        initialCapital: type === 'investment' ? balanceNum : existingAccount.initialCapital,
        initialBalance: type === 'investment' ? balanceNum : existingAccount.initialBalance,
        creditLimit: type === 'credit' ? limitNum : undefined,
        annualInterestRate: type === 'investment' ? returnRateNum : undefined,
        compoundingFrequency: type === 'investment' ? compoundingFrequency : undefined,
        reinvestReturns: type === 'investment' ? reinvestReturns : undefined,
        recurringContributionAmount: (type === 'investment' && recurringContributionEnabled) ? recAmountNum : undefined,
        recurringContributionFrequency: (type === 'investment' && recurringContributionEnabled) ? recurringContributionFrequency : undefined,
        nextContributionDate: (type === 'investment' && recurringContributionEnabled) ? nextContributionDate : undefined,
      });
    } else {
      addFinanceAccount({
        ...baseData,
        currentBalance: balanceNum,
        initialBalance: balanceNum,
        initialCapital: type === 'investment' ? balanceNum : undefined,
        totalContributions: type === 'investment' ? 0 : undefined,
        accumulatedReturns: type === 'investment' ? 0 : undefined,
        creditLimit: type === 'credit' ? limitNum : undefined,
        annualInterestRate: type === 'investment' ? returnRateNum : undefined,
        compoundingFrequency: type === 'investment' ? compoundingFrequency : undefined,
        reinvestReturns: type === 'investment' ? reinvestReturns : undefined,
        recurringContributionAmount: (type === 'investment' && recurringContributionEnabled) ? recAmountNum : undefined,
        recurringContributionFrequency: (type === 'investment' && recurringContributionEnabled) ? recurringContributionFrequency : undefined,
        nextContributionDate: (type === 'investment' && recurringContributionEnabled) ? nextContributionDate : undefined,
      });
    }
    
    onClose();
  };

  const accountTypes = [
    { id: 'bank', label: _t('بنكي', 'Bank', 'Bankkonto'), icon: Landmark },
    { id: 'wallet', label: _t('محفظة', 'Wallet', 'Brieftasche'), icon: Wallet },
    { id: 'cash', label: _t('كاش', 'Cash', 'Bargeld'), icon: Banknote },
    { id: 'credit', label: _t('ائتمان', 'Credit', 'Kreditkarte'), icon: CreditCard },
    { id: 'investment', label: _t('استثمار', 'Investment', 'Investition'), icon: TrendingUp },
  ] as const;

  // Preview Object
  const previewAccount: Partial<FinanceAccount> = {
    name: name || _t('اسم الحساب', 'Account Name', 'Kontoname'),
    type,
    currency,
    bankName: bankName || undefined,
    color,
    accountNumber: accountNumber || '8824',
    currentBalance: parseFloat(initialBalance) || 0,
    creditLimit: type === 'credit' ? (parseFloat(creditLimit) || 0) : undefined,
    annualInterestRate: type === 'investment' ? (parseFloat(annualReturnRate) || 0) : undefined,
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-surface border border-surface-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-border bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-text-main">
                {existingAccount ? _t('تعديل الحساب البنكي', 'Edit Account', 'Konto bearbeiten') : _t('إضافة حساب بنكي / محفظة', 'Add Bank Account / Card', 'Neues Bankkonto')}
              </h3>
              <p className="text-xs text-text-muted">
                {_t('بطاقة رقمية تفاعلية لإدارة أموالك', 'Interactive digital card for your finances', 'Interaktive digitale Karte')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full hover:bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-main transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          
          {/* Live Card Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                {_t('معاينة البطاقة الحية', 'Live Card Preview', 'Live-Kartenvorschau')}
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {_t('مظهر حقيقي', 'Real Look', 'Echte Vorschau')}
              </span>
            </div>
            <div className="max-w-sm mx-auto">
              <BankCard 
                account={previewAccount} 
                isInteractive={false} 
                size="md"
              />
            </div>
          </div>

          {/* Color Selection (User Choice) */}
          <div className="bg-surface-hover/50 p-3.5 rounded-2xl border border-surface-border">
            <label className="block text-xs font-bold text-text-main mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                {_t('لون البطاقة (اختر مظهرك المفضل)', 'Card Theme & Color', 'Kartenfarbe wählen')}
              </span>
              <span className="text-[11px] font-bold text-primary">
                {CARD_THEMES[color]?.nameAr || CARD_THEMES[color]?.name}
              </span>
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
              {Object.values(CARD_THEMES).map(t => {
                const isSelected = color === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setColor(t.id)}
                    title={t.nameAr || t.name}
                    className={`h-9 w-full rounded-xl transition-all duration-200 flex items-center justify-center relative shadow-xs ${
                      isSelected 
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110' 
                        : 'hover:scale-105 opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: t.previewColor }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Name & Bank Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {_t('اسم الحساب', 'Account Name', 'Kontoname')} *
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder={_t('مثال: الحساب الجاري، كاش', 'e.g. Current Account, Cash', 'z.B. Hauptkonto')}
                className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-text-muted" />
                {_t('اسم البنك / الجهة', 'Bank / Institution', 'Bank / Institut')}
              </label>
              <input 
                type="text" 
                value={bankName} 
                onChange={e => setBankName(e.target.value)} 
                placeholder={_t('مثال: بنك مصر، CIB، فودافون', 'e.g. Bank Misr, CIB, Wise', 'z.B. CIB, NBE')}
                className="w-full px-3.5 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          {/* Account Type Selector */}
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2">
              {_t('نوع الحساب المالي', 'Account Type', 'Kontotyp')}
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {accountTypes.map(t => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeChange(t.id as any)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                      isSelected 
                        ? 'bg-primary text-white border-primary shadow-sm font-bold scale-[1.02]' 
                        : 'bg-surface-hover/70 border-surface-border text-text-muted hover:bg-surface-hover hover:text-text-main font-medium'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[10px] text-center leading-tight truncate w-full">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currency & Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('العملة', 'Currency', 'Währung')}</label>
              <select 
                value={currency} 
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="EGP">EGP (ج.م)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="SAR">SAR (ر.س)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                {type === 'investment' 
                  ? _t('رأس المال الأولي', 'Initial Capital', 'Anfangskapital')
                  : (existingAccount ? _t('الرصيد الحالي', 'Current Balance', 'Aktueller Saldo') : _t('الرصيد الافتتاحي', 'Initial Balance', 'Anfangssaldo'))}
              </label>
              <input 
                type="number" 
                value={initialBalance} 
                onChange={e => setInitialBalance(e.target.value)} 
                disabled={!!existingAccount && type !== 'investment'}
                placeholder="0.00"
                className={`w-full px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-sm font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${(existingAccount && type !== 'investment') ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('رقم الحساب (آخر 4 أرقام)', 'Account / Card #', 'Konto-Nr.')}</label>
              <input 
                type="text" 
                value={accountNumber} 
                onChange={e => setAccountNumber(e.target.value)} 
                placeholder="e.g. 4821"
                maxLength={16}
                className="w-full px-3 py-2.5 bg-surface-hover border border-surface-border rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Credit limit */}
          {type === 'credit' && (
            <div className="bg-surface-hover/60 p-3.5 rounded-2xl border border-surface-border">
              <label className="block text-xs font-bold text-text-main mb-1.5">{_t('الحد الائتماني (Credit Limit)', 'Credit Limit', 'Kreditlimit')}</label>
              <input 
                type="number" 
                value={creditLimit} 
                onChange={e => setCreditLimit(e.target.value)} 
                placeholder="e.g. 50000"
                className="w-full px-3 py-2.5 bg-surface border border-surface-border rounded-xl text-sm font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          )}

          {/* Investment Settings */}
          {type === 'investment' && (
            <div className="space-y-4 border border-surface-border bg-surface-hover/30 p-4 rounded-2xl">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {_t('إعدادات العائد والاستثمار', 'Investment Returns & Growth', 'Investitionseinstellungen')}
              </h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('العائد السنوي المتوقع %', 'Annual Return %', 'Jährliche Rendite %')}</label>
                  <input 
                    type="number" 
                    value={annualReturnRate} 
                    onChange={e => setAnnualReturnRate(e.target.value)} 
                    placeholder="e.g. 18.5"
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">{_t('دورية حساب الأرباح', 'Compounding', 'Zinseszins')}</label>
                  <select 
                    value={compoundingFrequency} 
                    onChange={e => setCompoundingFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-surface border border-surface-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="daily">{_t('يومياً (Daily)', 'Daily', 'Täglich')}</option>
                    <option value="monthly">{_t('شهرياً (Monthly)', 'Monthly', 'Monatlich')}</option>
                    <option value="yearly">{_t('سنوياً (Yearly)', 'Yearly', 'Jährlich')}</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-surface border border-surface-border rounded-xl cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={reinvestReturns} 
                  onChange={e => setReinvestReturns(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded" 
                />
                <div>
                  <span className="text-xs font-bold block text-text-main">{_t('إعادة استثمار الأرباح تلقائياً (العائد المركب)', 'Auto-Reinvest Returns (Compound Interest)', 'Renditen reinvestieren')}</span>
                  <span className="text-[10px] text-text-muted">{_t('حساب العائد على رأس المال + الأرباح السابقة', 'Calculate return on capital + accumulated profits', 'Rendite auf Kapital + Gewinne')}</span>
                </div>
              </label>

              <div className="border border-surface-border rounded-xl overflow-hidden bg-surface">
                <label className="flex items-center gap-3 p-3 bg-surface-hover/70 cursor-pointer border-b border-surface-border">
                  <input 
                    type="checkbox" 
                    checked={recurringContributionEnabled} 
                    onChange={e => setRecurringContributionEnabled(e.target.checked)}
                    className="w-5 h-5 accent-primary rounded" 
                  />
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-text-main">{_t('مساهمة دورية منتظمة', 'Recurring Contribution', 'Wiederkehrende Beiträge')}</span>
                  </div>
                </label>
                
                {recurringContributionEnabled && (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5">{_t('المبلغ الدوري', 'Amount', 'Betrag')}</label>
                        <input 
                          type="number" 
                          value={recurringContributionAmount} 
                          onChange={e => setRecurringContributionAmount(e.target.value)} 
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5">{_t('التكرار', 'Frequency', 'Häufigkeit')}</label>
                        <select 
                          value={recurringContributionFrequency} 
                          onChange={e => setRecurringContributionFrequency(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="daily">{_t('يومياً', 'Daily', 'Täglich')}</option>
                          <option value="weekly">{_t('أسبوعياً', 'Weekly', 'Wöchentlich')}</option>
                          <option value="monthly">{_t('شهرياً', 'Monthly', 'Monatlich')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted mb-1.5">{_t('تاريخ الاستحقاق القادم', 'Next Due Date', 'Nächstes Datum')}</label>
                      <input 
                        type="date" 
                        value={nextContributionDate} 
                        onChange={e => setNextContributionDate(e.target.value)} 
                        className="w-full px-2.5 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {existingAccount && (
            <label className="flex items-center gap-3 p-3 bg-surface-hover/60 border border-surface-border rounded-xl cursor-pointer">
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)}
                className="w-5 h-5 accent-primary rounded" 
              />
              <span className="text-xs font-bold text-text-main">{_t('الحساب نشط ويظهر في العمليات المالية', 'Active Account', 'Aktives Konto')}</span>
            </label>
          )}
        </div>
        
        {/* Footer Buttons */}
        <div className="p-4 sm:p-5 border-t border-surface-border shrink-0 bg-surface flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-surface-hover hover:bg-surface-border text-text-main rounded-2xl font-bold transition-colors text-sm"
          >
            {_t('إلغاء', 'Cancel', 'Abbrechen')}
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-2 py-3 px-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-extrabold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 text-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {existingAccount ? _t('تحديث الحساب', 'Update Account', 'Konto aktualisieren') : _t('إنشاء وحفظ البطاقة', 'Create & Save Card', 'Konto erstellen')}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, Info } from 'lucide-react';
import { goldPriceStorage } from '../../../services/goldPrice/goldPriceStorage';
import { GoldPriceHistory, formatCairoDateTime } from '../../../services/goldPrice/goldPriceTypes';

type ChartRange = '1D' | '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const GoldPriceChart: React.FC = () => {
  const { _t, latestGoldPrice } = useApp();
  const [history, setHistory] = useState<GoldPriceHistory[]>([]);
  const [selectedRange, setSelectedRange] = useState<ChartRange>('7D');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const data = await goldPriceStorage.getPriceHistory();
        if (isMounted) {
          setHistory(data);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    };
    loadHistory();
  }, [latestGoldPrice]);

  // Filter history by range
  const filteredData = useMemo(() => {
    if (!history || history.length === 0) return [];

    const now = Date.now();
    let cutoffMs = 0;

    switch (selectedRange) {
      case '1D':
        cutoffMs = 24 * 60 * 60 * 1000;
        break;
      case '7D':
        cutoffMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case '1M':
        cutoffMs = 30 * 24 * 60 * 60 * 1000;
        break;
      case '3M':
        cutoffMs = 90 * 24 * 60 * 60 * 1000;
        break;
      case '6M':
        cutoffMs = 180 * 24 * 60 * 60 * 1000;
        break;
      case '1Y':
        cutoffMs = 365 * 24 * 60 * 60 * 1000;
        break;
      case 'ALL':
      default:
        cutoffMs = Infinity;
        break;
    }

    const filtered = cutoffMs === Infinity
      ? history
      : history.filter(item => (now - new Date(item.fetchedAt).getTime()) <= cutoffMs);

    return filtered.map(item => ({
      time: new Date(item.fetchedAt).getTime(),
      dateStr: formatCairoDateTime(item.fetchedAt, { showTime: selectedRange === '1D' || selectedRange === '7D' }),
      price: item.pricePerGram24K,
      status: item.status,
    }));
  }, [history, selectedRange]);

  // Statistics for period
  const stats = useMemo(() => {
    if (filteredData.length < 2) return null;
    const prices = filteredData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = filteredData[0].price;
    const last = filteredData[filteredData.length - 1].price;
    const diff = last - first;
    const percent = first > 0 ? (diff / first) * 100 : 0;
    return { min, max, diff, percent: Math.round(percent * 100) / 100 };
  }, [filteredData]);

  const ranges: ChartRange[] = ['1D', '7D', '1M', '3M', '6M', '1Y', 'ALL'];

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
      {/* Header & Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-text-main uppercase tracking-wider">
              {_t('حركة سعر عيار 24 التاريخية', '24K Price History Chart', 'Goldpreis-Verlauf')}
            </h4>
            {stats && (
              <div className="flex items-center gap-2 text-[10px] font-bold mt-0.5">
                <span className={stats.diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {stats.diff >= 0 ? '+' : ''}{stats.diff.toLocaleString()} EGP ({stats.diff >= 0 ? '+' : ''}{stats.percent}%)
                </span>
                <span className="text-text-muted">•</span>
                <span className="text-text-muted">
                  {_t('أدنى:', 'Low:', 'Tief:')} {stats.min.toLocaleString()}
                </span>
                <span className="text-text-muted">•</span>
                <span className="text-text-muted">
                  {_t('أعلى:', 'High:', 'Hoch:')} {stats.max.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1 bg-surface-hover/80 p-0.5 rounded-lg border border-surface-border self-start sm:self-auto overflow-x-auto">
          {ranges.map(range => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                selectedRange === range
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas or Friendly Insufficient Data View */}
      {filteredData.length < 2 ? (
        <div className="h-44 sm:h-52 border border-dashed border-surface-border rounded-xl flex flex-col items-center justify-center p-4 text-center bg-surface-hover/20">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-1.5">
            <Info className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-text-main mb-1">
            {_t('لا توجد بيانات تاريخية كافية بعد', 'Not enough historical data yet.', 'Noch nicht genügend historische Daten.')}
          </p>
          <p className="text-[11px] text-text-muted max-w-xs">
            {_t(
              'يقوم التطبيق بحفظ الأسعار الحقيقية دورياً محلياً على جهازك لإنشاء الرسم البياني تدريجياً دون فبركة أي أسعار.',
              'Prices retrieved over time will be recorded locally to plot your actual market trend.',
              'Reale Preise werden lokal gespeichert.'
            )}
          </p>
        </div>
      ) : (
        <div className="h-44 sm:h-52 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-surface-border/40" />
              <XAxis 
                dataKey="dateStr" 
                tick={{ fontSize: 9, fill: 'currentColor' }} 
                className="text-text-muted"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['dataMin - 10', 'dataMax + 10']}
                tick={{ fontSize: 9, fill: 'currentColor' }} 
                className="text-text-muted"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-surface border border-surface-border p-2 rounded-lg shadow-lg text-[11px] space-y-0.5">
                        <p className="font-black text-amber-500">{data.price.toLocaleString()} EGP / g</p>
                        <p className="text-[9px] text-text-muted">{data.dateStr}</p>
                        <p className="text-[9px] text-text-muted">{data.status === 'live' ? '🟢 Live' : '🟠 Cached'}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#f59e0b" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#goldGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

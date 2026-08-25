const fs = require('fs');
let content = fs.readFileSync('src/components/finance/FinanceDashboard.tsx', 'utf8');

const targetStr = `{profile.financeStreak ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded-lg">
              <Flame className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-600">{profile.financeStreak} {_t('أيام', 'days', 'Tage')}</span>
            </div>
          ) : null}`;

const replaceStr = `{profile.financeStreak && profile.financeStreak > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🔥</span>
              <span className="text-[11px] font-extrabold text-amber-500 uppercase tracking-wider">{profile.financeStreak} {_t('يوم متتالي', 'day streak', 'Tage in Folge')}</span>
            </div>
          ) : null}`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/finance/FinanceDashboard.tsx', content);

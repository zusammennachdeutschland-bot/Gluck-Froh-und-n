import { FinanceAccount, FinanceTransaction } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const calculateAccountPerformance = (
  accountId: string,
  transactions: FinanceTransaction[]
) => {
  const now = new Date();
  
  // Use Cairo timezone explicitly
  const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const todayPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}-${String(cairoNow.getDate()).padStart(2, '0')}`;
  const monthPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}`;

  const accountTxs = transactions.filter(
    tx => !tx.deleted && (tx.accountId === accountId || tx.toAccountId === accountId)
  );

  let todayChange = 0;
  let monthChange = 0;

  for (const tx of accountTxs) {
    if (!tx.date) continue;
    
    // Parse using string prefixes (safe, avoids timezone shift bugs)
    const isToday = tx.date.startsWith(todayPrefix);
    const isThisMonth = tx.date.startsWith(monthPrefix);
    
    // Calculate effective amount for THIS account
    let effectiveAmount = 0;
    
    if (tx.type === 'income' || tx.type === 'investment_return' || (tx.type === 'adjustment' && tx.amount > 0)) {
        if (tx.accountId === accountId) effectiveAmount = tx.amount;
    } else if (tx.type === 'expense' || (tx.type === 'adjustment' && tx.amount < 0)) {
        if (tx.accountId === accountId) effectiveAmount = -Math.abs(tx.amount);
    } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId) effectiveAmount = -tx.amount;
        if (tx.toAccountId === accountId) effectiveAmount = tx.amount;
    }

    if (isToday) todayChange += effectiveAmount;
    if (isThisMonth) monthChange += effectiveAmount;
  }

  // Round to 2 decimal places to avoid floating point issues
  todayChange = Math.round(todayChange * 100) / 100;
  monthChange = Math.round(monthChange * 100) / 100;

  return { todayChange, monthChange };
};

export const calculateTodaysIncome = (transactions: FinanceTransaction[]) => {
  const now = new Date();
  const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const todayPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}-${String(cairoNow.getDate()).padStart(2, '0')}`;

  let todayIncome = 0;
  for (const tx of transactions) {
    if (!tx.deleted && tx.date && tx.date.startsWith(todayPrefix)) {
      if (tx.type === 'income' || tx.type === 'investment_return') {
        todayIncome += tx.amount;
      }
    }
  }

  return Math.round(todayIncome * 100) / 100;
};

export const processInvestmentReturns = (
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[],
  addTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt' | 'updatedAt'>) => void,
  updateAccount: (id: string, updates: Partial<FinanceAccount>) => void
) => {
  const now = new Date();
  const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const todayPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}-${String(cairoNow.getDate()).padStart(2, '0')}`;
  const monthPrefix = `${cairoNow.getFullYear()}-${String(cairoNow.getMonth() + 1).padStart(2, '0')}`;
  const yearPrefix = `${cairoNow.getFullYear()}`;

  for (const account of accounts) {
    if (!account.investmentEnabled || !account.annualRate || account.deleted) continue;
    
    // Determine the period key based on frequency
    let periodKey = '';
    let rateFraction = 0;
    
    if (account.calculationFrequency === 'daily') {
      periodKey = `daily_${todayPrefix}`;
      rateFraction = account.annualRate / 365 / 100;
    } else if (account.calculationFrequency === 'monthly') {
      periodKey = `monthly_${monthPrefix}`;
      rateFraction = account.annualRate / 12 / 100;
    } else if (account.calculationFrequency === 'yearly') {
      periodKey = `yearly_${yearPrefix}`;
      rateFraction = account.annualRate / 100;
    } else {
      continue;
    }

    // Check if we already processed this period for this account
    const alreadyProcessed = transactions.some(
      tx => tx.accountId === account.id && 
            tx.type === 'investment_return' && 
            tx.investmentPeriodKey === periodKey &&
            !tx.deleted
    );

    if (!alreadyProcessed) {
      // Calculate return
      let returnAmount = account.currentBalance * rateFraction;
      
      // Avoid floating point precision issues (round to 2 decimals)
      returnAmount = Math.round(returnAmount * 100) / 100;
      
      if (returnAmount > 0) {
        addTransaction({
          type: 'investment_return',
          amount: returnAmount,
          accountId: account.id,
          date: cairoNow.toISOString(),
          note: `عائد استثمار (${periodKey})`,
          investmentPeriodKey: periodKey
        });

        if (account.compounding) {
          updateAccount(account.id, {
            currentBalance: account.currentBalance + returnAmount
          });
        }
      }
    }
  }
};

import { FinanceAccount, FinanceTransaction } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pure, deterministic calculation of an account's financial balance based on the ledger.
 * Single Source of Truth: FinanceTransactions
 */
export const computeAccountBalance = (
  account: FinanceAccount,
  transactions: FinanceTransaction[]
): number => {
  if (!account) return 0;
  
  // Baseline initial balance (safeguard for migrated or newly created accounts)
  const initial = account.initialBalance !== undefined 
    ? account.initialBalance 
    : (account.openingBalance !== undefined ? account.openingBalance : 0);
  
  let balance = initial;
  
  if (!Array.isArray(transactions)) {
    return Math.round(balance * 100) / 100;
  }

  // Iterate deterministically through all non-deleted transactions
  for (const tx of transactions) {
    if (!tx || tx.deleted) continue;

    if (tx.type === 'income' || tx.type === 'investment_return') {
      if (tx.accountId === account.id) {
        balance += tx.amount || 0;
      }
    } else if (tx.type === 'expense') {
      if (tx.accountId === account.id) {
        balance -= tx.amount || 0;
      }
    } else if (tx.type === 'adjustment') {
      if (tx.accountId === account.id) {
        // Positive adjustment increases balance, negative adjustment decreases balance
        balance += tx.amount || 0;
      }
    } else if (tx.type === 'transfer') {
      if (tx.accountId === account.id) {
        balance -= tx.amount || 0;
      }
      if (tx.toAccountId === account.id) {
        balance += tx.amount || 0;
      }
    }
  }

  return Math.round(balance * 100) / 100;
};

/**
 * Recomputes and updates the cached currentBalance for all accounts deterministically.
 */
export const recalculateAllAccountBalances = (
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[]
): FinanceAccount[] => {
  if (!accounts || !Array.isArray(accounts)) return [];
  const safeTxs = Array.isArray(transactions) ? transactions : [];

  return accounts.map(acc => {
    const safeAccount = { ...acc };
    // Baseline safeguard: preserve initialBalance if undefined
    if (safeAccount.initialBalance === undefined) {
      if (safeAccount.openingBalance !== undefined) {
        safeAccount.initialBalance = safeAccount.openingBalance;
      } else if (safeAccount.currentBalance !== undefined) {
        safeAccount.initialBalance = safeAccount.currentBalance;
      } else {
        safeAccount.initialBalance = 0;
      }
    }

    const derivedBalance = computeAccountBalance(safeAccount, safeTxs);
    return {
      ...safeAccount,
      currentBalance: derivedBalance,
    };
  });
};

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

import { FinanceAccount, FinanceTransaction, PaymentRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { normalizeDateToISO, formatLocalDate } from '../utils/timeUtils';

const extractNormalizedPaymentDates = (lessonDates?: string[]): string[] => {
  if (!Array.isArray(lessonDates) || lessonDates.length === 0) return [];
  const out: string[] = [];
  for (const dStr of lessonDates) {
    if (!dStr || typeof dStr !== 'string') continue;
    const match = dStr.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{1,2}-\d{1,2})/);
    if (match) {
      const iso = normalizeDateToISO(match[1]);
      if (iso) out.push(iso);
    }
  }
  return out;
};

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

/**
 * Fix #1/#2/#3: Determines whether an existing pending payment record belongs to the exact cycle being settled.
 * When both sides carry real non-virtual lesson IDs, matches strictly by lesson ID overlap so unrelated
 * cycles sharing a date or group are never mistakenly settled. Only falls back to normalized dates
 * when at least one side lacks lesson IDs (legacy records).
 */
export const shouldSettlePendingCycleRecord = (
  record: PaymentRecord,
  paidCycle: { studentId: string; groupId?: string; lessonIds?: string[]; lessonDates?: string[] }
): boolean => {
  if (record.deleted) return false;
  if (record.studentId !== paidCycle.studentId) return false;
  const st = String(record.status || '');
  if (st !== 'not_yet' && st !== 'pending' && st !== 'unpaid' && st !== 'partial' && st !== 'overdue') return false;

  const recordIds: string[] = [];
  if (record.lessonId && !record.lessonId.startsWith('virtual_')) {
    recordIds.push(record.lessonId);
  }
  if (Array.isArray(record.lessonIds)) {
    for (const id of record.lessonIds) {
      if (id && !id.startsWith('virtual_') && !recordIds.includes(id)) {
        recordIds.push(id);
      }
    }
  }

  const targetIds = new Set((paidCycle.lessonIds || []).filter(id => id && !id.startsWith('virtual_')));
  const overlapsIds = recordIds.length > 0 && targetIds.size > 0 && recordIds.some(id => targetIds.has(id));

  if (targetIds.size > 0 && recordIds.length > 0) {
    return overlapsIds;
  }

  if (paidCycle.groupId && record.groupId && paidCycle.groupId !== record.groupId) {
    return false;
  }

  const recordDates = extractNormalizedPaymentDates(record.lessonDates);
  const targetDates = new Set(extractNormalizedPaymentDates(paidCycle.lessonDates));
  return recordDates.length > 0 && targetDates.size > 0 && recordDates.some(d => targetDates.has(d));
};

/**
 * Fix #2: Computes total students needing payment and total amount due without double-counting records
 * already represented in dueCycles and using amountDue/amountPaid so NaN never occurs.
 */
export const calculateStudentDueBannerTotals = (
  dueCycles: { id: string; existingPaymentRecordId?: string; amountDue?: number }[],
  payments: PaymentRecord[]
): { totalStudentsNeedingPayment: number; totalAmountDueFromStudents: number } => {
  const safeCycles = Array.isArray(dueCycles) ? dueCycles : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const coveredRecordIds = new Set<string>();
  for (const cycle of safeCycles) {
    if (cycle.id) coveredRecordIds.add(cycle.id);
    if (cycle.existingPaymentRecordId) coveredRecordIds.add(cycle.existingPaymentRecordId);
  }

  const standalonePendingList = safePayments.filter(p => {
    const st = String(p.status || '');
    return !p.deleted && (st === 'not_paid' || st === 'partial') && !coveredRecordIds.has(p.id);
  });

  const cycleTotal = safeCycles.reduce((sum, c) => sum + (Number(c.amountDue) || 0), 0);
  const pendingTotal = standalonePendingList.reduce((sum, p) => {
    const legacyRec = p as PaymentRecord & { amount?: number; paidAmount?: number };
    const due = Number(legacyRec.amountDue ?? legacyRec.amount ?? 0) || 0;
    const paid = Number(legacyRec.amountPaid ?? legacyRec.paidAmount ?? 0) || 0;
    return sum + Math.max(0, due - paid);
  }, 0);

  return {
    totalStudentsNeedingPayment: safeCycles.length + standalonePendingList.length,
    totalAmountDueFromStudents: Math.round((cycleTotal + pendingTotal) * 100) / 100,
  };
};

/**
 * Fix #3: Applies a payment state updater to the full archive list as well as active RAM state,
 * ensuring quick toggles and pending cycle records are never lost on subsequent archive syncs.
 */
export const applyFullPaymentsUpdate = (
  fullPayments: PaymentRecord[],
  updater: (prev: PaymentRecord[]) => PaymentRecord[],
  filterActive: (all: PaymentRecord[]) => PaymentRecord[]
): { nextFull: PaymentRecord[]; nextActive: PaymentRecord[] } => {
  const nextFull = updater(fullPayments);
  const nextActive = filterActive(nextFull);
  return { nextFull, nextActive };
};

/**
 * Task 4: Splits a package payment across `count` lessons so that the per-lesson amounts
 * sum to `amountPaid` exactly (putting any rounding remainder on the last lesson).
 */
export const splitPaymentAcrossLessons = (amountPaid: number, count: number): number[] => {
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const safeTotal = round2(Number(amountPaid) || 0);
  if (!Number.isFinite(count) || count <= 1) {
    return [safeTotal];
  }
  const n = Math.floor(count);
  const isIntegerTotal = Number.isInteger(safeTotal);
  const baseShare = isIntegerTotal
    ? Math.floor(safeTotal / n)
    : Math.floor((safeTotal * 100) / n) / 100;
  const shares: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    shares.push(baseShare);
    allocated = round2(allocated + baseShare);
  }
  shares.push(round2(safeTotal - allocated));
  return shares;
};

/**
 * Finance #5: Allocates an advance payment FIFO across oldest eligible unpaid invoices
 * for the same student up to the paid amount, preserving any partial remainders and
 * converting only leftover surplus into advance lesson credits.
 */
export const allocateAdvancePaymentFIFO = <T extends PaymentRecord>(
  payments: T[],
  options: {
    studentId: string;
    studentName: string;
    groupId: string;
    groupName: string;
    numberOfLessons: number;
    amount: number;
    accountId: string;
    notes?: string;
    today?: string;
    paymentId?: string;
    wrapMutation?: (item: T) => T;
  }
): {
  updatedPayments: T[];
  advanceRecord: T;
  settledLessonIds: string[];
  appliedToDebt: number;
  surplusAmount: number;
  surplusLessons: number;
} => {
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const today = options.today || formatLocalDate();
  const wrap = options.wrapMutation || ((item: T) => item);
  const paymentId = options.paymentId || `pay_adv_${options.studentId}_${Date.now()}`;
  const totalPaid = round2(Math.max(0, Number(options.amount) || 0));

  const isEligibleUnpaid = (p: T): boolean => {
    if (!p || p.deleted) return false;
    if (p.studentId !== options.studentId) return false;
    if (p.paymentType === 'exemption' || p.paymentType === 'advance_payment') return false;
    const st = String(p.status || '');
    if (st === 'paid' || st === 'exempted') return false;
    const netDue = Math.max(0, (Number(p.amountDue) || 0) - (Number(p.discountAmount) || 0));
    const alreadyPaid = Math.max(0, Number(p.amountPaid) || 0);
    return netDue - alreadyPaid > 0;
  };

  const eligibleSorted = payments
    .filter(isEligibleUnpaid)
    .sort((a, b) => {
      const da = normalizeDateToISO(a.dueDate || '') || normalizeDateToISO(a.createdAt || '') || '9999-99-99';
      const db = normalizeDateToISO(b.dueDate || '') || normalizeDateToISO(b.createdAt || '') || '9999-99-99';
      if (da !== db) return da.localeCompare(db);
      const ca = a.createdAt || '';
      const cb = b.createdAt || '';
      if (ca !== cb) return ca.localeCompare(cb);
      return a.id.localeCompare(b.id);
    });

  let remainingFunds = totalPaid;
  let appliedToDebt = 0;
  const allocatedById = new Map<string, { newPaid: number; newRem: number; newStatus: 'paid' | 'partial'; applied: number }>();
  const settledLessonIds: string[] = [];

  for (const p of eligibleSorted) {
    if (remainingFunds <= 0) break;
    const netDue = Math.max(0, (Number(p.amountDue) || 0) - (Number(p.discountAmount) || 0));
    const alreadyPaid = Math.max(0, Number(p.amountPaid) || 0);
    const owed = round2(Math.max(0, netDue - alreadyPaid));
    if (owed <= 0) continue;

    const applied = round2(Math.min(owed, remainingFunds));
    if (applied <= 0) continue;

    const newPaid = round2(alreadyPaid + applied);
    const newRem = round2(Math.max(0, netDue - newPaid));
    const newStatus: 'paid' | 'partial' = newRem <= 0 ? 'paid' : 'partial';

    remainingFunds = round2(Math.max(0, remainingFunds - applied));
    appliedToDebt = round2(appliedToDebt + applied);
    allocatedById.set(p.id, { newPaid, newRem, newStatus, applied });

    if (newStatus === 'paid') {
      if (p.lessonId && !p.lessonId.startsWith('virtual_') && !settledLessonIds.includes(p.lessonId)) {
        settledLessonIds.push(p.lessonId);
      }
      if (Array.isArray(p.lessonIds)) {
        for (const lid of p.lessonIds) {
          if (lid && !lid.startsWith('virtual_') && !settledLessonIds.includes(lid)) {
            settledLessonIds.push(lid);
          }
        }
      }
    }
  }

  const surplusAmount = round2(Math.max(0, remainingFunds));
  const requestedLessons = Math.max(0, Number(options.numberOfLessons) || 0);
  let surplusLessons = 0;
  if (surplusAmount > 0 && requestedLessons > 0) {
    surplusLessons = appliedToDebt === 0
      ? requestedLessons
      : (totalPaid > 0 ? Math.floor((surplusAmount / totalPaid) * requestedLessons + 1e-9) : 0);
  }

  const updatedList = payments.map(p => {
    const alloc = allocatedById.get(p.id);
    if (!alloc) return p;
    return wrap({
      ...p,
      amountPaid: alloc.newPaid,
      remainingBalance: alloc.newRem,
      status: alloc.newStatus,
      paidDate: alloc.newStatus === 'paid' ? today : p.paidDate,
      financeAccountId: options.accountId || p.financeAccountId,
      notes: alloc.newStatus === 'paid'
        ? `${p.notes || ''} (تمت التسوية بسداد مقدم)`.trim()
        : `${p.notes || ''} (سداد جزئي من الدفع المقدم: ${alloc.applied})`.trim()
    } as T);
  });

  const advanceRecord = wrap({
    id: paymentId,
    studentId: options.studentId,
    studentName: options.studentName,
    groupId: options.groupId,
    groupName: options.groupName,
    amountDue: totalPaid,
    amountPaid: totalPaid,
    advanceAmount: surplusAmount,
    remainingBalance: 0,
    dueDate: today,
    paidDate: today,
    status: 'paid',
    paymentType: 'advance_payment',
    bundleSize: surplusLessons,
    financeAccountId: options.accountId,
    notes: options.notes || (
      appliedToDebt > 0
        ? `سداد مقدم (${totalPaid}): سداد مستحقات سابقة (${appliedToDebt}) + رصيد (${surplusLessons} حصص)`
        : `سداد حصص مقدماً (عدد ${surplusLessons} حصص)`
    ),
    lessonDates: [
      surplusLessons > 0
        ? `سداد مقدم (${surplusLessons} حصص)`
        : `تسوية مستحقات سابقة (${appliedToDebt})`
    ],
    lessonIds: [],
    createdAt: new Date().toISOString()
  } as unknown as T);

  return {
    updatedPayments: [advanceRecord, ...updatedList],
    advanceRecord,
    settledLessonIds,
    appliedToDebt,
    surplusAmount,
    surplusLessons
  };
};

/**
 * Finance #4: Reconciles the single income FinanceTransaction associated with a payment record
 * so changing the receiving account or re-saving payment moves/updates the existing transaction
 * idempotently without creating duplicate income entries.
 */
export const reconcilePaymentFinanceTransaction = (
  transactions: FinanceTransaction[],
  accounts: FinanceAccount[],
  params: {
    paymentId: string;
    matchPaymentIds?: string[];
    accountId: string;
    amount: number;
    date: string;
    note: string;
    relatedStudentId?: string;
    categoryId?: string;
    wrapMutation?: <X>(item: X) => X;
    wrapDeletion?: <X>(item: X) => X;
  }
): {
  nextTransactions: FinanceTransaction[];
  nextAccounts: FinanceAccount[];
  transactionId: string;
  action: 'updated' | 'created' | 'noop';
} => {
  const safeTxs = Array.isArray(transactions) ? transactions : [];
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const wrapMut = params.wrapMutation || (<X>(x: X) => x);
  const wrapDel = params.wrapDeletion || (<X>(x: X) => x);

  const matchIds = new Set<string>([params.paymentId, ...(params.matchPaymentIds || [])].filter(Boolean));
  const activeMatching = safeTxs.filter(
    tx => !tx.deleted && tx.type === 'income' && tx.relatedPaymentId && matchIds.has(tx.relatedPaymentId)
  );

  let nextTransactions = [...safeTxs];
  let transactionId = '';
  let action: 'updated' | 'created' | 'noop' = 'noop';

  if (activeMatching.length > 0) {
    const primary = activeMatching[0];
    transactionId = primary.id;
    const duplicateIds = new Set(activeMatching.slice(1).map(tx => tx.id));
    const needsUpdate =
      primary.accountId !== params.accountId ||
      Math.abs((primary.amount || 0) - params.amount) > 0.001 ||
      primary.relatedPaymentId !== params.paymentId ||
      primary.note !== params.note ||
      duplicateIds.size > 0;

    if (needsUpdate) {
      nextTransactions = safeTxs.map(tx => {
        if (tx.id === primary.id) {
          return wrapMut({
            ...tx,
            accountId: params.accountId,
            amount: params.amount,
            note: params.note,
            relatedPaymentId: params.paymentId,
            relatedStudentId: params.relatedStudentId ?? tx.relatedStudentId,
            updatedAt: Date.now(),
            version: (tx.version || 1) + 1
          });
        }
        if (duplicateIds.has(tx.id)) {
          return wrapDel(tx);
        }
        return tx;
      });
      action = 'updated';
    }
  } else if (params.amount > 0) {
    transactionId = `ftx_${uuidv4()}`;
    const created = wrapMut({
      id: transactionId,
      type: 'income',
      amount: params.amount,
      accountId: params.accountId,
      categoryId: params.categoryId || 'cat_student_fees',
      date: params.date,
      note: params.note,
      relatedStudentId: params.relatedStudentId,
      relatedPaymentId: params.paymentId,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      version: 1
    } as FinanceTransaction);
    nextTransactions = [created, ...safeTxs];
    action = 'created';
  }

  let workingAccounts = safeAccounts;
  if (params.accountId && !workingAccounts.some(a => a.id === params.accountId)) {
    workingAccounts = [
      ...workingAccounts,
      {
        id: params.accountId,
        name: 'الخزينة الرئيسية (كاش)',
        type: 'cash',
        openingBalance: 0,
        initialBalance: 0,
        currentBalance: 0,
        currency: 'EGP',
        createdAt: new Date().toISOString(),
        updatedAt: Date.now(),
        version: 1
      } as FinanceAccount
    ];
  }

  const nextAccounts = recalculateAllAccountBalances(workingAccounts, nextTransactions);
  return { nextTransactions, nextAccounts, transactionId, action };
};

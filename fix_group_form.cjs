const fs = require('fs');
let content = fs.readFileSync('src/components/GroupForm.tsx', 'utf8');

content = content.replace(
  "paymentMethod: 'vodafone_cash' | 'cash' | 'bank_transfer' | 'paypal' | 'instapay';",
  "defaultFinanceAccountId?: string;"
);

content = content.replace(
  "const [paymentMethod, setPaymentMethod] = useState<'vodafone_cash' | 'cash' | 'bank_transfer' | 'paypal' | 'instapay'>(initialData?.paymentMethod || 'vodafone_cash');",
  "const { financeAccounts } = useApp();\n  const [defaultFinanceAccountId, setDefaultFinanceAccountId] = useState(initialData?.defaultFinanceAccountId || (financeAccounts?.[0]?.id || ''));"
);

content = content.replace(
  "paymentMethod,",
  "defaultFinanceAccountId,"
);

const selectHtml = `<select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold"
            >
              <option value="vodafone_cash">Vodafone Cash</option>
              <option value="instapay">InstaPay</option>
              <option value="cash">Bargeld (Cash)</option>
              <option value="bank_transfer">Banküberweisung</option>
              <option value="paypal">PayPal</option>
            </select>`;

const newSelectHtml = `<select
              value={defaultFinanceAccountId}
              onChange={(e) => setDefaultFinanceAccountId(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface border border-surface-border dark:border-surface-border-soft rounded-xl text-xs font-semibold"
            >
              <option value="">{t('choose', 'Choose...', 'Wählen...')}</option>
              {financeAccounts.filter(a => !a.deleted).map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>`;

content = content.replace(selectHtml, newSelectHtml);

fs.writeFileSync('src/components/GroupForm.tsx', content);

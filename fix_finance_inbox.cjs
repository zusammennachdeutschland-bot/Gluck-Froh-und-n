const fs = require('fs');
let content = fs.readFileSync('src/components/finance/FinanceInbox.tsx', 'utf8');

// The original updatePayment is:
// updatePayment(paymentId, newStatus, newPaid, totalDiscount, advanceAmount, refundAmount, method, notes, accountId)

content = content.replace(/updatePayment\(payment\.id, \{\n\s*status: 'paid',\n\s*amountPaid: payment\.amountDue,\n\s*datePaid: new Date\(\)\.toISOString\(\)\n\s*\}\);/g, 
  "updatePayment(payment.id, 'paid', payment.amountDue, payment.discountAmount || 0, payment.advanceAmount || 0, payment.refundAmount || 0, 'cash', 'Paid from Inbox', selectedAccountId);"
);

fs.writeFileSync('src/components/finance/FinanceInbox.tsx', content);

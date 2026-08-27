import re

with open('src/components/finance/FinanceView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "{ id: 'student-payments', label: _t('الطلاب', 'Students', 'Schüler'), icon: Landmark }",
    "{ id: 'student-payments', label: _t('الطلاب', 'Students', 'Schüler'), icon: Users }"
)
content = content.replace(
    "{ id: 'accounts', label: _t('الحسابات', 'Accounts', 'Konten'), icon: Landmark }",
    "{ id: 'accounts', label: _t('الحسابات', 'Accounts', 'Konten'), icon: Wallet }"
)
# Add Users to import
if "Users" not in content and "lucide-react" in content:
    content = content.replace("import { PieChart, ArrowRightLeft, Landmark, Repeat, CreditCard, Bell, ChevronLeft, FileText } from 'lucide-react';", "import { PieChart, ArrowRightLeft, Landmark, Repeat, CreditCard, Bell, ChevronLeft, FileText, Users, Wallet } from 'lucide-react';")

with open('src/components/finance/FinanceView.tsx', 'w') as f:
    f.write(content)

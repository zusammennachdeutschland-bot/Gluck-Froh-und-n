import re

with open('src/context/AppContext.tsx', 'r') as f:
    content = f.read()

# Fix the imports
content = content.replace("FinanceInstallment, FinanceNotification, FinanceNotification", "FinanceInstallment, FinanceNotification")
content = content.replace("FinanceInstallment, FinanceNotification", "FinanceInstallment")
# Then add it correctly:
content = content.replace("FinanceInstallment } from '../types';", "FinanceInstallment, FinanceNotification } from '../types';")

# Fix the type definition:
# We need to find the broken lines and replace them with correct ones
content = re.sub(r"  financeInstallments: FinanceInstallment\[\];.*?  financeNotifications: FinanceNotification\[\];", """  financeInstallments: FinanceInstallment[];
  setFinanceInstallments: React.Dispatch<React.SetStateAction<FinanceInstallment[]>>;
  addFinanceInstallment: (installment: Omit<FinanceInstallment, 'id' | 'createdAt' | 'updatedAt' | 'originRevision' | 'originDeviceId' | 'updatedByDeviceId' | 'deleted' | 'version'>) => FinanceInstallment;
  updateFinanceInstallment: (id: string, updates: Partial<FinanceInstallment>) => void;
  deleteFinanceInstallment: (id: string) => void;
  
  financeNotifications: FinanceNotification[];""", content, flags=re.DOTALL)

with open('src/context/AppContext.tsx', 'w') as f:
    f.write(content)

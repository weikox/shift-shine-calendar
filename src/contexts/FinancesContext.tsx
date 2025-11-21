import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  account: string;
  executed: boolean;
  category: 'fixed' | 'periodic' | 'extra' | 'daily' | 'income';
  date: string;
  periodicity?: 'monthly' | 'quarterly' | 'annual';
  documents?: FileDocument[];
}

export interface FileDocument {
  id: string;
  name: string;
  type: string;
  data: string; // base64
}

export interface AccountBalance {
  name: string;
  balance: number;
}

export interface Transfer {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  date: string;
  note?: string;
}

interface FinancesContextType {
  transactions: Transaction[];
  accounts: AccountBalance[];
  transfers: Transfer[];
  currentMonth: string;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addTransfer: (transfer: Omit<Transfer, 'id'>) => void;
  loadPreviousMonth: () => void;
  exportData: (format: 'json' | 'csv' | 'xlsx') => void;
  importData: (data: string) => void;
  setCurrentMonth: (month: string) => void;
  getTransactionsByCategory: (category: Transaction['category']) => Transaction[];
  getAccountTransactions: (accountName: string) => Transaction[];
  updateAccountBalance: (accountName: string, newBalance: number) => void;
  addAccount: (name: string) => void;
  updateAccount: (oldName: string, newName: string) => void;
  deleteAccount: (name: string) => void;
  getTotalBalance: () => number;
  getPendingTransactionsTotal: () => number;
}

const FinancesContext = createContext<FinancesContextType | undefined>(undefined);

export const FinancesProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountBalance[]>([
    { name: "Banco 1", balance: 0 },
    { name: "Banco 2", balance: 0 },
    { name: "Contado", balance: 0 },
  ]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Load data from localStorage
  useEffect(() => {
    const savedTransactions = localStorage.getItem(`finances-transactions-${currentMonth}`);
    const savedAccounts = localStorage.getItem('finances-accounts');
    const savedTransfers = localStorage.getItem(`finances-transfers-${currentMonth}`);
    
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
    if (savedTransfers) setTransfers(JSON.parse(savedTransfers));
  }, [currentMonth]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(`finances-transactions-${currentMonth}`, JSON.stringify(transactions));
  }, [transactions, currentMonth]);

  useEffect(() => {
    localStorage.setItem('finances-accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(`finances-transfers-${currentMonth}`, JSON.stringify(transfers));
  }, [transfers, currentMonth]);

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `${Date.now()}-${Math.random()}`,
    };
    setTransactions([...transactions, newTransaction]);
    
    // Update account balance if executed
    if (transaction.executed) {
      updateAccountBalanceFromTransaction(newTransaction);
    }
    toast.success("Movimiento añadido");
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    const oldTransaction = transactions.find(t => t.id === id);
    
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ));
    
    const newTransaction = { ...oldTransaction, ...updates } as Transaction;
    
    // Adjust account balance if execution status changed
    if (oldTransaction && oldTransaction.executed !== newTransaction.executed) {
      updateAccountBalanceFromTransaction(newTransaction, oldTransaction.executed ? 'remove' : 'add');
    }
    
    toast.success("Movimiento actualizado");
  };

  const deleteTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction && transaction.executed) {
      updateAccountBalanceFromTransaction(transaction, 'remove');
    }
    setTransactions(transactions.filter(t => t.id !== id));
    toast.success("Movimiento eliminado");
  };

  const updateAccountBalanceFromTransaction = (transaction: Transaction, operation: 'add' | 'remove' = 'add') => {
    setAccounts(prevAccounts => 
      prevAccounts.map(acc => {
        if (acc.name === transaction.account) {
          const multiplier = operation === 'add' ? 1 : -1;
          const amount = transaction.category === 'income' 
            ? transaction.amount * multiplier 
            : -transaction.amount * multiplier;
          return { ...acc, balance: acc.balance + amount };
        }
        return acc;
      })
    );
  };

  const addTransfer = (transfer: Omit<Transfer, 'id'>) => {
    const newTransfer: Transfer = {
      ...transfer,
      id: `transfer-${Date.now()}-${Math.random()}`,
    };
    setTransfers([...transfers, newTransfer]);
    
    // Update balances
    setAccounts(prevAccounts => 
      prevAccounts.map(acc => {
        if (acc.name === transfer.fromAccount) {
          return { ...acc, balance: acc.balance - transfer.amount };
        }
        if (acc.name === transfer.toAccount) {
          return { ...acc, balance: acc.balance + transfer.amount };
        }
        return acc;
      })
    );
    
    toast.success("Traspaso realizado");
  };

  const loadPreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevTransactions = localStorage.getItem(`finances-transactions-${prevMonth}`);
    if (prevTransactions) {
      const parsedTransactions = JSON.parse(prevTransactions);
      // Only load pending transactions
      const pendingTransactions = parsedTransactions
        .filter((t: Transaction) => !t.executed)
        .map((t: Transaction) => ({ ...t, id: `${Date.now()}-${Math.random()}`, date: currentMonth }));
      
      setTransactions([...transactions, ...pendingTransactions]);
      toast.success("Movimientos pendientes cargados");
    } else {
      toast.info("No hay datos del mes anterior");
    }
  };

  const getTransactionsByCategory = (category: Transaction['category']) => {
    return transactions.filter(t => t.category === category);
  };

  const getAccountTransactions = (accountName: string) => {
    const accountTransactions = transactions.filter(t => t.account === accountName);
    const accountTransfers = transfers.filter(t => 
      t.fromAccount === accountName || t.toAccount === accountName
    );
    
    return accountTransactions;
  };

  const updateAccountBalance = (accountName: string, newBalance: number) => {
    setAccounts(prevAccounts => 
      prevAccounts.map(acc => 
        acc.name === accountName ? { ...acc, balance: newBalance } : acc
      )
    );
  };

  const exportData = (format: 'json' | 'csv' | 'xlsx') => {
    const data = {
      transactions,
      accounts,
      transfers,
      month: currentMonth
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finanzas-${currentMonth}.json`;
      a.click();
      toast.success("Datos exportados en JSON");
    } else if (format === 'csv') {
      let csv = 'Nombre,Cantidad,Cuenta,Categoría,Ejecutado,Fecha\n';
      transactions.forEach(t => {
        csv += `"${t.name}",${t.amount},"${t.account}","${t.category}",${t.executed},${t.date}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finanzas-${currentMonth}.csv`;
      a.click();
      toast.success("Datos exportados en CSV");
    }
  };

  const importData = (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.transactions) setTransactions(data.transactions);
      if (data.accounts) setAccounts(data.accounts);
      if (data.transfers) setTransfers(data.transfers);
      toast.success("Datos importados correctamente");
    } catch (error) {
      toast.error("Error al importar datos");
    }
  };

  const addAccount = (name: string) => {
    if (accounts.some(acc => acc.name === name)) {
      toast.error("Ya existe una cuenta con ese nombre");
      return;
    }
    setAccounts([...accounts, { name, balance: 0 }]);
    toast.success("Cuenta añadida");
  };

  const updateAccount = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    if (accounts.some(acc => acc.name === newName)) {
      toast.error("Ya existe una cuenta con ese nombre");
      return;
    }
    
    // Update account name
    setAccounts(prevAccounts => 
      prevAccounts.map(acc => 
        acc.name === oldName ? { ...acc, name: newName } : acc
      )
    );
    
    // Update transactions
    setTransactions(prevTransactions => 
      prevTransactions.map(t => 
        t.account === oldName ? { ...t, account: newName } : t
      )
    );
    
    // Update transfers
    setTransfers(prevTransfers => 
      prevTransfers.map(t => ({
        ...t,
        fromAccount: t.fromAccount === oldName ? newName : t.fromAccount,
        toAccount: t.toAccount === oldName ? newName : t.toAccount,
      }))
    );
    
    toast.success("Cuenta actualizada");
  };

  const deleteAccount = (name: string) => {
    const hasTransactions = transactions.some(t => t.account === name);
    const hasTransfers = transfers.some(t => t.fromAccount === name || t.toAccount === name);
    
    if (hasTransactions || hasTransfers) {
      toast.error("No se puede eliminar una cuenta con movimientos asociados");
      return;
    }
    
    setAccounts(accounts.filter(acc => acc.name !== name));
    toast.success("Cuenta eliminada");
  };

  const getTotalBalance = () => {
    return accounts.reduce((total, acc) => total + acc.balance, 0);
  };

  const getPendingTransactionsTotal = () => {
    return transactions
      .filter(t => !t.executed)
      .reduce((total, t) => {
        return total + (t.category === 'income' ? t.amount : -t.amount);
      }, 0);
  };

  return (
    <FinancesContext.Provider
      value={{
        transactions,
        accounts,
        transfers,
        currentMonth,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addTransfer,
        loadPreviousMonth,
        exportData,
        importData,
        setCurrentMonth,
        getTransactionsByCategory,
        getAccountTransactions,
        updateAccountBalance,
        addAccount,
        updateAccount,
        deleteAccount,
        getTotalBalance,
        getPendingTransactionsTotal,
      }}
    >
      {children}
    </FinancesContext.Provider>
  );
};

export const useFinances = () => {
  const context = useContext(FinancesContext);
  if (!context) {
    throw new Error("useFinances must be used within FinancesProvider");
  }
  return context;
};

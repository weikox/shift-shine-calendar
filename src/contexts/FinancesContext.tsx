import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useAuth } from "@/hooks/useAuth";

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
  data: string;
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
  addTransaction: (transaction: Omit<Transaction, 'id'>) => string;
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
  getPreviousMonthBalance: () => number;
  getPreviousMonthBalanceByAccount: (accountName: string) => number;
  getPendingByAccount: (accountName: string) => number;
  syncToCloud: () => Promise<void>;
  lastSync: Date | null;
}

const FinancesContext = createContext<FinancesContextType | undefined>(undefined);

export const FinancesProvider = ({ children }: { children: ReactNode }) => {
  const { storageMethod, autoSync } = useStorageMethod();
  const { user } = useAuth();
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
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingSync, setPendingSync] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [storageMethod, user, currentMonth]);

  const loadInitialData = async () => {
    if (storageMethod === 'local' || !user) {
      // Load from localStorage
      const savedTransactions = localStorage.getItem(`finances-transactions-${currentMonth}`);
      const savedAccounts = localStorage.getItem('finances-accounts');
      const savedTransfers = localStorage.getItem(`finances-transfers-${currentMonth}`);
      
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
      if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
      if (savedTransfers) setTransfers(JSON.parse(savedTransfers));
    } else if (storageMethod === 'cloud') {
      // Load only from cloud
      await loadFromCloud();
    } else if (storageMethod === 'hybrid') {
      // Load from cloud and fallback to local
      await loadFromCloud();
    }
  };

  const loadFromCloud = async () => {
    if (!user) return;

    try {
      // Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);

      if (accountsError) throw accountsError;

      // Create mapping of account ID to account name
      const accountIdToName: Record<string, string> = {};
      if (accountsData && accountsData.length > 0) {
        accountsData.forEach(acc => {
          accountIdToName[acc.id] = acc.name;
        });
        
        setAccounts(accountsData.map(acc => ({
          name: acc.name,
          balance: 0 // Balance is calculated from transactions
        })));
      }

      // Load transactions for current month
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth);

      if (transactionsError) throw transactionsError;

      if (transactionsData) {
        const mappedTransactions: Transaction[] = transactionsData.map(t => ({
          id: t.id,
          name: t.description,
          amount: Number(t.amount),
          account: accountIdToName[t.account_id] || t.account_id,
          executed: !t.pending,
          category: t.type as any,
          date: t.date,
        }));
        setTransactions(mappedTransactions);
        
        // Calculate account balances from transactions
        const balances: Record<string, number> = {};
        mappedTransactions.forEach(t => {
          if (t.executed) {
            if (!balances[t.account]) balances[t.account] = 0;
            balances[t.account] += t.category === 'income' ? t.amount : -t.amount;
          }
        });
        
        setAccounts(prev => prev.map(acc => ({
          ...acc,
          balance: balances[acc.name] || 0
        })));
      }

      // Load transfers for current month
      const { data: transfersData, error: transfersError } = await supabase
        .from('transfers')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth);

      if (transfersError) throw transfersError;

      if (transfersData) {
        const mappedTransfers: Transfer[] = transfersData.map(t => ({
          id: t.id,
          fromAccount: accountIdToName[t.from_account_id] || t.from_account_id,
          toAccount: accountIdToName[t.to_account_id] || t.to_account_id,
          amount: Number(t.amount),
          date: t.date,
          note: t.description,
        }));
        setTransfers(mappedTransfers);
        
        // Apply transfers to balances
        setAccounts(prev => prev.map(acc => {
          let balance = acc.balance;
          mappedTransfers.forEach(transfer => {
            if (transfer.fromAccount === acc.name) balance -= transfer.amount;
            if (transfer.toAccount === acc.name) balance += transfer.amount;
          });
          return { ...acc, balance };
        }));
      }

      setLastSync(new Date());
      console.log('✅ Cloud data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading from cloud:', error);
      toast.error('Error al cargar datos de la nube');
      
      // Fallback to localStorage in hybrid mode
      if (storageMethod === 'hybrid') {
        const savedTransactions = localStorage.getItem(`finances-transactions-${currentMonth}`);
        const savedAccounts = localStorage.getItem('finances-accounts');
        const savedTransfers = localStorage.getItem(`finances-transfers-${currentMonth}`);
        
        if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
        if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
        if (savedTransfers) setTransfers(JSON.parse(savedTransfers));
      }
    }
  };

  const syncToCloud = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para sincronizar');
      return;
    }

    console.log('🔄 Starting cloud sync...');
    setPendingSync(true);
    try {
      // Get account IDs mapping
      const accountMapping: Record<string, string> = {};
      
      console.log('📊 Syncing accounts:', accounts.length);
      for (const account of accounts) {
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', account.name)
          .maybeSingle();

        if (existingAccount) {
          accountMapping[account.name] = existingAccount.id;
        } else {
          const { data: newAccount, error } = await supabase
            .from('accounts')
            .insert({ user_id: user.id, name: account.name })
            .select('id')
            .single();

          if (error) {
            console.error('❌ Error creating account:', account.name, error);
            throw error;
          }
          if (newAccount) {
            accountMapping[account.name] = newAccount.id;
            console.log('✅ Created account:', account.name);
          }
        }
      }

      // Sync transactions in batch
      console.log('💰 Syncing transactions:', transactions.length);
      const transactionsToSync = transactions
        .filter(t => accountMapping[t.account])
        .map(transaction => ({
          id: transaction.id,
          user_id: user.id,
          account_id: accountMapping[transaction.account],
          description: transaction.name,
          amount: transaction.amount,
          type: transaction.category,
          date: transaction.date,
          month: currentMonth,
          pending: !transaction.executed,
        }));

      if (transactionsToSync.length > 0) {
        const { error: transError } = await supabase
          .from('transactions')
          .upsert(transactionsToSync);
        
        if (transError) {
          console.error('❌ Error syncing transactions:', transError);
          throw transError;
        }
        console.log('✅ Synced transactions:', transactionsToSync.length);
      }

      // Sync transfers in batch
      console.log('🔄 Syncing transfers:', transfers.length);
      const transfersToSync = transfers
        .filter(t => accountMapping[t.fromAccount] && accountMapping[t.toAccount])
        .map(transfer => ({
          id: transfer.id,
          user_id: user.id,
          from_account_id: accountMapping[transfer.fromAccount],
          to_account_id: accountMapping[transfer.toAccount],
          amount: transfer.amount,
          date: transfer.date,
          month: currentMonth,
          description: transfer.note || '',
        }));

      if (transfersToSync.length > 0) {
        const { error: transferError } = await supabase
          .from('transfers')
          .upsert(transfersToSync);
        
        if (transferError) {
          console.error('❌ Error syncing transfers:', transferError);
          throw transferError;
        }
        console.log('✅ Synced transfers:', transfersToSync.length);
      }

      setLastSync(new Date());
      console.log('✅ Cloud sync completed successfully');
      toast.success('Datos financieros sincronizados con la nube');
    } catch (error) {
      console.error('❌ Error syncing to cloud:', error);
      toast.error('Error al sincronizar con la nube');
    } finally {
      setPendingSync(false);
    }
  };

  const saveToStorage = () => {
    // Always save to localStorage for instant feedback
    if (storageMethod !== 'cloud') {
      localStorage.setItem(`finances-transactions-${currentMonth}`, JSON.stringify(transactions));
      localStorage.setItem('finances-accounts', JSON.stringify(accounts));
      localStorage.setItem(`finances-transfers-${currentMonth}`, JSON.stringify(transfers));
    }

    // Sync to cloud if needed
    if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
      if (autoSync && !pendingSync) {
        setTimeout(() => syncToCloud(), 2000); // Debounce 2s
      }
    }
  };

  useEffect(() => {
    saveToStorage();
  }, [transactions, accounts, transfers]);

  const addTransaction = (transaction: Omit<Transaction, 'id'>): string => {
    const newId = `${Date.now()}-${Math.random()}`;
    const newTransaction: Transaction = {
      ...transaction,
      id: newId,
    };
    setTransactions([...transactions, newTransaction]);
    
    if (transaction.executed) {
      updateAccountBalanceFromTransaction(newTransaction);
    }
    toast.success("Movimiento añadido");
    return newId;
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    const oldTransaction = transactions.find(t => t.id === id);
    if (!oldTransaction) return;
    
    const newTransaction = { ...oldTransaction, ...updates } as Transaction;
    
    setTransactions(transactions.map(t => 
      t.id === id ? newTransaction : t
    ));
    
    // If old transaction was executed, remove its effect from balance
    if (oldTransaction.executed) {
      setAccounts(prevAccounts => 
        prevAccounts.map(acc => {
          if (acc.name === oldTransaction.account) {
            const amount = oldTransaction.category === 'income' 
              ? -oldTransaction.amount 
              : oldTransaction.amount;
            return { ...acc, balance: acc.balance + amount };
          }
          return acc;
        })
      );
    }
    
    // If new transaction is executed, add its effect to balance
    if (newTransaction.executed) {
      setAccounts(prevAccounts => 
        prevAccounts.map(acc => {
          if (acc.name === newTransaction.account) {
            const amount = newTransaction.category === 'income' 
              ? newTransaction.amount 
              : -newTransaction.amount;
            return { ...acc, balance: acc.balance + amount };
          }
          return acc;
        })
      );
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
    return transactions.filter(t => t.account === accountName);
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
    
    setAccounts(prevAccounts => 
      prevAccounts.map(acc => 
        acc.name === oldName ? { ...acc, name: newName } : acc
      )
    );
    
    setTransactions(prevTransactions => 
      prevTransactions.map(t => 
        t.account === oldName ? { ...t, account: newName } : t
      )
    );
    
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

  const getPreviousMonthBalance = () => {
    // Calculate the previous month
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Try to get from localStorage
    const savedTransactions = localStorage.getItem(`finances-transactions-${prevMonth}`);
    if (savedTransactions) {
      const prevTransactions: Transaction[] = JSON.parse(savedTransactions);
      return prevTransactions
        .filter(t => t.executed)
        .reduce((total, t) => {
          return total + (t.category === 'income' ? t.amount : -t.amount);
        }, 0);
    }
    
    return 0;
  };

  const getPreviousMonthBalanceByAccount = (accountName: string) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const savedTransactions = localStorage.getItem(`finances-transactions-${prevMonth}`);
    if (savedTransactions) {
      const prevTransactions: Transaction[] = JSON.parse(savedTransactions);
      return prevTransactions
        .filter(t => t.executed && t.account === accountName)
        .reduce((total, t) => {
          return total + (t.category === 'income' ? t.amount : -t.amount);
        }, 0);
    }
    
    return 0;
  };

  const getPendingByAccount = (accountName: string) => {
    return transactions
      .filter(t => !t.executed && t.account === accountName)
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
        getPreviousMonthBalance,
        getPreviousMonthBalanceByAccount,
        getPendingByAccount,
        syncToCloud,
        lastSync,
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
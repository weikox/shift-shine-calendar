import { useState, useMemo } from "react";
import { useFinances, Transaction, Transfer } from "@/contexts/FinancesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ChevronRight, ChevronDown, LayoutList, Building2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTransactionDocumentCounts } from "@/hooks/useTransactionDocumentCounts";
import { TransactionDocumentsDialog } from "@/components/TransactionDocumentsDialog";

type ViewMode = "type" | "account";

const CATEGORY_LABELS: Record<Transaction["category"], string> = {
  income: "Ingresos",
  fixed: "Gastos fijos",
  periodic: "Periódicos",
  extra: "Extra",
  daily: "Diarios",
};

const CATEGORY_ORDER: Transaction["category"][] = ["income", "fixed", "periodic", "extra", "daily"];

const EXECUTED_OPTIONS = [
  { value: "yes", label: "Ejecutadas" },
  { value: "no", label: "Pendientes" },
];

export const FinancialSummaryCard = () => {
  const { transactions, transfers, accounts, currentMonth } = useFinances();

  const [viewMode, setViewMode] = useState<ViewMode>("type");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<Transaction["category"]>>(new Set());
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedExecuted, setSelectedExecuted] = useState<Set<string>>(new Set());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);

  const transactionIds = useMemo(() => transactions.map(t => t.id), [transactions]);
  const { hasDocuments } = useTransactionDocumentCounts(transactionIds);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFilter = <T extends string>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const handleTransactionClick = (t: Transaction) => {
    const hasDocs = (t.documents && t.documents.length > 0) || hasDocuments(t.id);
    if (hasDocs) {
      setSelectedTransaction(t);
      setDocsDialogOpen(true);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedTypes.size > 0 && !selectedTypes.has(t.category)) return false;
      if (selectedAccounts.size > 0 && !selectedAccounts.has(t.account)) return false;
      if (selectedExecuted.size > 0) {
        const matchExecuted = selectedExecuted.has("yes") && t.executed;
        const matchPending = selectedExecuted.has("no") && !t.executed;
        if (!matchExecuted && !matchPending) return false;
      }
      return true;
    });
  }, [transactions, selectedTypes, selectedAccounts, selectedExecuted]);

  const filteredTransfers = useMemo(() => {
    if (selectedTypes.size > 0) return []; // transfers don't have a category type
    return transfers.filter((t) => {
      if (selectedAccounts.size > 0) {
        return selectedAccounts.has(t.fromAccount) || selectedAccounts.has(t.toAccount);
      }
      return true;
    });
  }, [transfers, selectedTypes, selectedAccounts]);

  const grandTotal = useMemo(() => {
    let total = 0;
    filteredTransactions.forEach((t) => {
      total += t.category === "income" ? t.amount : -t.amount;
    });
    // Transfers are zero-sum, don't add to total
    return total;
  }, [filteredTransactions]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, { transactions: Transaction[]; total: number }> = {};
    CATEGORY_ORDER.forEach((cat) => {
      const items = filteredTransactions.filter((t) => t.category === cat);
      if (items.length > 0) {
        const total = items.reduce((sum, t) => sum + (cat === "income" ? t.amount : -t.amount), 0);
        groups[cat] = { transactions: items, total };
      }
    });
    // Add transfers group if any
    if (filteredTransfers.length > 0) {
      groups["transfers"] = {
        transactions: [],
        total: 0, // zero-sum
      };
    }
    return groups;
  }, [filteredTransactions, filteredTransfers]);

  const groupedByAccount = useMemo(() => {
    const groups: Record<string, { items: Array<{ name: string; amount: number; isTransfer?: boolean; transactionId?: string }>; total: number }> = {};
    accounts.forEach((acc) => {
      if (selectedAccounts.size > 0 && !selectedAccounts.has(acc.name)) return;
      groups[acc.name] = { items: [], total: 0 };
    });

    filteredTransactions.forEach((t) => {
      if (!groups[t.account]) return;
      const signedAmount = t.category === "income" ? t.amount : -t.amount;
      groups[t.account].items.push({ name: t.name, amount: signedAmount, transactionId: t.id });
      groups[t.account].total += signedAmount;
    });

    filteredTransfers.forEach((t) => {
      if (groups[t.fromAccount]) {
        groups[t.fromAccount].items.push({
          name: `→ ${t.toAccount}${t.note ? ` (${t.note})` : ""}`,
          amount: -t.amount,
          isTransfer: true,
        });
        groups[t.fromAccount].total -= t.amount;
      }
      if (groups[t.toAccount]) {
        groups[t.toAccount].items.push({
          name: `← ${t.fromAccount}${t.note ? ` (${t.note})` : ""}`,
          amount: t.amount,
          isTransfer: true,
        });
        groups[t.toAccount].total += t.amount;
      }
    });

    // Remove empty accounts
    Object.keys(groups).forEach((key) => {
      if (groups[key].items.length === 0) delete groups[key];
    });

    return groups;
  }, [filteredTransactions, filteredTransfers, accounts, selectedAccounts]);

  const monthLabel = useMemo(() => {
    const [y, m] = currentMonth.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }, [currentMonth]);

  return (
    <Card className="transition-all hover:shadow-lg">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Finanzas — {monthLabel}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "type" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode("type")}
            >
              <LayoutList className="h-3.5 w-3.5 mr-1" />
              Tipo
            </Button>
            <Button
              variant={viewMode === "account" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode("account")}
            >
              <Building2 className="h-3.5 w-3.5 mr-1" />
              Cuenta
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-1 space-y-2">
        {/* Filters */}
        <div className="flex flex-wrap gap-1">
          {CATEGORY_ORDER.map((cat) => (
            <Badge
              key={cat}
              variant={selectedTypes.has(cat) ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-1.5 py-0 leading-4"
              onClick={() => toggleFilter(selectedTypes, cat, setSelectedTypes)}
            >
              {CATEGORY_LABELS[cat]}
            </Badge>
          ))}
          <span className="text-muted-foreground text-[10px] mx-0.5 self-center">|</span>
          {accounts.map((acc) => (
            <Badge
              key={acc.name}
              variant={selectedAccounts.has(acc.name) ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-1.5 py-0 leading-4"
              onClick={() => toggleFilter(selectedAccounts, acc.name, setSelectedAccounts)}
            >
              {acc.name}
            </Badge>
          ))}
          <span className="text-muted-foreground text-[10px] mx-0.5 self-center">|</span>
          {EXECUTED_OPTIONS.map((opt) => (
            <Badge
              key={opt.value}
              variant={selectedExecuted.has(opt.value) ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-1.5 py-0 leading-4"
              onClick={() => toggleFilter(selectedExecuted, opt.value, setSelectedExecuted)}
            >
              {opt.label}
            </Badge>
          ))}
        </div>

        {/* Content */}
        <div className="border rounded-md overflow-hidden text-xs">
          {viewMode === "type" ? (
            <TypeView
              groups={groupedByType}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              filteredTransfers={filteredTransfers}
              onTransactionClick={handleTransactionClick}
              hasDocuments={(id) => hasDocuments(id)}
              transactions={transactions}
            />
          ) : (
            <AccountView
              groups={groupedByAccount}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              onTransactionClick={handleTransactionClick}
              hasDocuments={(id) => hasDocuments(id)}
              transactions={transactions}
            />
          )}

          {/* Grand total */}
          <div className="flex justify-between items-center px-2 py-1.5 bg-muted font-semibold border-t">
            <span>Total</span>
            <span className={grandTotal >= 0 ? "text-green-600" : "text-red-600"}>
              {grandTotal >= 0 ? "+" : ""}
              {grandTotal.toFixed(2)}€
            </span>
          </div>
        </div>
      </CardContent>

      <TransactionDocumentsDialog
        transaction={selectedTransaction}
        open={docsDialogOpen}
        onOpenChange={setDocsDialogOpen}
      />
    </Card>
  );
};

/* ---- Type View ---- */
function TypeView({
  groups,
  expandedGroups,
  toggleGroup,
  filteredTransfers,
  onTransactionClick,
  hasDocuments,
  transactions,
}: {
  groups: Record<string, { transactions: Transaction[]; total: number }>;
  expandedGroups: Set<string>;
  toggleGroup: (key: string) => void;
  filteredTransfers: Transfer[];
  onTransactionClick: (t: Transaction) => void;
  hasDocuments: (id: string) => boolean;
  transactions: Transaction[];
}) {
  return (
    <div>
      {CATEGORY_ORDER.map((cat) => {
        const group = groups[cat];
        if (!group) return null;
        const isExpanded = expandedGroups.has(cat);
        const isIncome = cat === "income";

        return (
          <div key={cat}>
            <button
              onClick={() => toggleGroup(cat)}
              className="w-full flex items-center justify-between px-2 py-1 hover:bg-muted/50 border-b"
            >
              <div className="flex items-center gap-1">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
                <span className="text-muted-foreground">({group.transactions.length})</span>
              </div>
              <span className={cn("font-medium", isIncome ? "text-green-600" : "text-red-600")}>
                {group.total >= 0 ? "+" : ""}
                {group.total.toFixed(2)}€
              </span>
            </button>
            {isExpanded && (
              <div className="bg-muted/20">
                {group.transactions
                  .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
                  .map((t) => {
                    const hasDocs = (t.documents && t.documents.length > 0) || hasDocuments(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => hasDocs && onTransactionClick(t)}
                        className={cn(
                          "flex items-center justify-between px-4 py-0.5 border-b border-border/50",
                          hasDocs && "cursor-pointer hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", t.executed ? "bg-green-500" : "bg-yellow-500")} />
                          <span className="truncate">{t.name}</span>
                          {hasDocs && <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                          <span className="text-muted-foreground flex-shrink-0">{t.account}</span>
                        </div>
                        <span className={cn("flex-shrink-0 ml-2", isIncome ? "text-green-600" : "text-red-600")}>
                          {isIncome ? "+" : "-"}{t.amount.toFixed(2)}€
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}

      {/* Transfers group */}
      {filteredTransfers.length > 0 && (
        <div>
          <button
            onClick={() => toggleGroup("transfers")}
            className="w-full flex items-center justify-between px-2 py-1 hover:bg-muted/50 border-b"
          >
            <div className="flex items-center gap-1">
              {expandedGroups.has("transfers") ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="font-medium">Traspasos</span>
              <span className="text-muted-foreground">({filteredTransfers.length})</span>
            </div>
            <span className="text-muted-foreground font-medium">0.00€</span>
          </button>
          {expandedGroups.has("transfers") && (
            <div className="bg-muted/20">
              {filteredTransfers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-4 py-0.5 border-b border-border/50"
                >
                  <span className="truncate">
                    {t.fromAccount} → {t.toAccount}
                    {t.note ? ` (${t.note})` : ""}
                  </span>
                  <span className="text-muted-foreground flex-shrink-0 ml-2">
                    {t.amount.toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Account View ---- */
function AccountView({
  groups,
  expandedGroups,
  toggleGroup,
  onTransactionClick,
  hasDocuments,
  transactions,
}: {
  groups: Record<string, { items: Array<{ name: string; amount: number; isTransfer?: boolean; transactionId?: string }>; total: number }>;
  expandedGroups: Set<string>;
  toggleGroup: (key: string) => void;
  onTransactionClick: (t: Transaction) => void;
  hasDocuments: (id: string) => boolean;
  transactions: Transaction[];
}) {
  const accountNames = Object.keys(groups);

  if (accountNames.length === 0) {
    return <div className="px-2 py-3 text-center text-muted-foreground">Sin movimientos</div>;
  }

  return (
    <div>
      {accountNames.map((accName) => {
        const group = groups[accName];
        const isExpanded = expandedGroups.has(accName);

        return (
          <div key={accName}>
            <button
              onClick={() => toggleGroup(accName)}
              className="w-full flex items-center justify-between px-2 py-1 hover:bg-muted/50 border-b"
            >
              <div className="flex items-center gap-1">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="font-medium">{accName}</span>
                <span className="text-muted-foreground">({group.items.length})</span>
              </div>
              <span className={cn("font-medium", group.total >= 0 ? "text-green-600" : "text-red-600")}>
                {group.total >= 0 ? "+" : ""}
                {group.total.toFixed(2)}€
              </span>
            </button>
            {isExpanded && (
              <div className="bg-muted/20">
                {group.items.map((item, i) => {
                  const tx = item.transactionId ? transactions.find(t => t.id === item.transactionId) : undefined;
                  const hasDocs = tx ? ((tx.documents && tx.documents.length > 0) || hasDocuments(tx.id)) : false;
                  return (
                    <div
                      key={i}
                      onClick={() => hasDocs && tx && onTransactionClick(tx)}
                      className={cn(
                        "flex items-center justify-between px-4 py-0.5 border-b border-border/50",
                        hasDocs && "cursor-pointer hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className={cn("truncate", item.isTransfer && "italic text-muted-foreground")}>
                          {item.name}
                        </span>
                        {hasDocs && <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                      </div>
                      <span className={cn("flex-shrink-0 ml-2", item.amount >= 0 ? "text-green-600" : "text-red-600")}>
                        {item.amount >= 0 ? "+" : ""}
                        {item.amount.toFixed(2)}€
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

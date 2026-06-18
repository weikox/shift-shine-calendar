import { useFinances, Transaction } from "@/contexts/FinancesContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Paperclip } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { useTransactionDocumentCounts } from "@/hooks/useTransactionDocumentCounts";

interface TransactionListProps {
  category: Transaction['category'];
  onEdit: (id: string) => void;
}

export const TransactionList = ({ category, onEdit }: TransactionListProps) => {
  const { transactions, updateTransaction, deleteTransaction, getTransactionsByCategory } = useFinances();
  const categoryTransactions = getTransactionsByCategory(category)
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return -1;
      if (!b.date) return 1;
      return a.date.localeCompare(b.date);
    });
  
  // Get transaction IDs for document count lookup
  const transactionIds = categoryTransactions.map(t => t.id);
  const { hasDocuments } = useTransactionDocumentCounts(transactionIds);

  const handleToggleExecuted = (id: string, currentStatus: boolean) => {
    updateTransaction(id, { executed: !currentStatus });
  };

  const totalAmount = categoryTransactions.reduce((sum, t) => {
    if (t.executed) {
      return sum + t.amount;
    }
    return sum;
  }, 0);

  if (categoryTransactions.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No hay {category === 'income' ? 'ingresos' : 'gastos'} registrados
      </p>
    );
  }

  const formatDate = (date: string | undefined) => {
    if (!date || date.length !== 10) return date || "-";
    return format(parse(date, "yyyy-MM-dd", new Date()), "d MMM", { locale: es });
  };

  return (
    <div className="space-y-4">
      {/* Mobile card layout */}
      <div className="sm:hidden space-y-2">
        {categoryTransactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
            <Checkbox
              checked={transaction.executed}
              onCheckedChange={() => handleToggleExecuted(transaction.id, transaction.executed)}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-medium text-sm truncate">{transaction.name}</span>
                <span className={`text-sm font-semibold shrink-0 ${category === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {category === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)}€
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                <span>{formatDate(transaction.date)}</span>
                <span>·</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{transaction.account}</Badge>
                {category === 'periodic' && transaction.periodicity && (
                  <>
                    <span>·</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      {transaction.periodicity === 'monthly' ? 'Mens.' : transaction.periodicity === 'quarterly' ? 'Trim.' : 'Anual'}
                    </Badge>
                  </>
                )}
                {((transaction.documents && transaction.documents.length > 0) || hasDocuments(transaction.id)) && (
                  <Paperclip className="h-3 w-3" />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(transaction.id)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                if (confirm('¿Eliminar este movimiento?')) deleteTransaction(transaction.id);
              }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table layout */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">✓</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Cuenta</TableHead>
              {category === 'periodic' && <TableHead>Periodicidad</TableHead>}
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <Checkbox
                    checked={transaction.executed}
                    onCheckedChange={() => handleToggleExecuted(transaction.id, transaction.executed)}
                  />
                </TableCell>
                <TableCell className="font-medium">{transaction.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDate(transaction.date)}</TableCell>
                <TableCell>
                  <span className={category === 'income' ? 'text-green-600' : 'text-red-600'}>
                    {category === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)}€
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{transaction.account}</Badge>
                </TableCell>
                {category === 'periodic' && (
                  <TableCell>
                    <Badge variant="secondary">
                      {transaction.periodicity === 'monthly' && 'Mensual'}
                      {transaction.periodicity === 'quarterly' && 'Trimestral'}
                      {transaction.periodicity === 'annual' && 'Anual'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  {((transaction.documents && transaction.documents.length > 0) || hasDocuments(transaction.id)) && (
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(transaction.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (confirm('¿Eliminar este movimiento?')) deleteTransaction(transaction.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-end">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total ejecutado</p>
          <p className={`text-2xl font-bold ${category === 'income' ? 'text-green-600' : 'text-red-600'}`}>
            {category === 'income' ? '+' : '-'}{totalAmount.toFixed(2)}€
          </p>
        </div>
      </div>
    </div>
  );
};

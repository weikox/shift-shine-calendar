import { useState } from "react";
import { useFinances } from "@/contexts/FinancesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const AccountBalanceTable = () => {
  const { accounts, transactions, getAccountTransactions, getPreviousMonthBalance } = useFinances();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [includePreviousMonth, setIncludePreviousMonth] = useState(true);
  const [includePending, setIncludePending] = useState(true);

  const previousMonthTotal = getPreviousMonthBalance();
  const pendingTransactions = transactions.filter(t => !t.executed);
  const pendingTotal = pendingTransactions.reduce((sum, t) => {
    return sum + (t.category === 'income' ? t.amount : -t.amount);
  }, 0);

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const adjustedTotal = totalBalance + 
    (includePreviousMonth ? previousMonthTotal : 0) +
    (includePending ? pendingTotal : 0);
  const accountTransactions = selectedAccount ? getAccountTransactions(selectedAccount) : [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Balance de Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Saldo Actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.name}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => setSelectedAccount(account.name)}
                >
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell className="text-right">
                    <span className={account.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {account.balance.toFixed(2)}€
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>Subtotal</TableCell>
                <TableCell className="text-right">
                  <span className={totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {totalBalance.toFixed(2)}€
                  </span>
                </TableCell>
              </TableRow>
              <TableRow className="text-sm">
                <TableCell className="flex items-center gap-2">
                  <Checkbox 
                    id="include-previous"
                    checked={includePreviousMonth} 
                    onCheckedChange={(checked) => setIncludePreviousMonth(checked as boolean)}
                  />
                  <Label htmlFor="include-previous" className="cursor-pointer">
                    Saldo mes anterior
                  </Label>
                </TableCell>
                <TableCell className="text-right">
                  <span className={previousMonthTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {previousMonthTotal.toFixed(2)}€
                  </span>
                </TableCell>
              </TableRow>
              <TableRow className="text-sm">
                <TableCell className="flex items-center gap-2">
                  <Checkbox 
                    id="include-pending"
                    checked={includePending} 
                    onCheckedChange={(checked) => setIncludePending(checked as boolean)}
                  />
                  <Label htmlFor="include-pending" className="cursor-pointer">
                    Movimientos pendientes
                  </Label>
                </TableCell>
                <TableCell className="text-right">
                  <span className={pendingTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {pendingTotal.toFixed(2)}€
                  </span>
                </TableCell>
              </TableRow>
              <TableRow className="font-bold text-lg border-t-2">
                <TableCell>Total Ajustado</TableCell>
                <TableCell className="text-right">
                  <span className={adjustedTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {adjustedTotal.toFixed(2)}€
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Movimientos de {selectedAccount}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {accountTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay movimientos en esta cuenta
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transaction.category === 'fixed' && 'Fijo'}
                          {transaction.category === 'periodic' && 'Periódico'}
                          {transaction.category === 'extra' && 'Extra'}
                          {transaction.category === 'daily' && 'Diario'}
                          {transaction.category === 'income' && 'Ingreso'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={transaction.category === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.category === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)}€
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={transaction.executed ? 'default' : 'secondary'}>
                          {transaction.executed ? 'Ejecutado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

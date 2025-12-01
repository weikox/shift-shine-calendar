import { useState } from "react";
import { useFinances } from "@/contexts/FinancesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const AccountBalanceTable = () => {
  const { accounts, transactions, getAccountTransactions, getPreviousMonthBalanceByAccount, getPendingByAccount } = useFinances();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showPreviousMonth, setShowPreviousMonth] = useState(true);
  const [showPending, setShowPending] = useState(true);

  const accountTransactions = selectedAccount ? getAccountTransactions(selectedAccount) : [];

  // Calculate totals
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalPreviousMonth = accounts.reduce((sum, acc) => sum + getPreviousMonthBalanceByAccount(acc.name), 0);
  const totalPending = accounts.reduce((sum, acc) => sum + getPendingByAccount(acc.name), 0);
  const grandTotal = totalBalance + 
    (showPreviousMonth ? totalPreviousMonth : 0) + 
    (showPending ? totalPending : 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Balance de Cuentas</CardTitle>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="show-previous"
                checked={showPreviousMonth} 
                onCheckedChange={(checked) => setShowPreviousMonth(checked as boolean)}
              />
              <Label htmlFor="show-previous" className="cursor-pointer text-sm">
                Mostrar Mes Anterior
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="show-pending"
                checked={showPending} 
                onCheckedChange={(checked) => setShowPending(checked as boolean)}
              />
              <Label htmlFor="show-pending" className="cursor-pointer text-sm">
                Mostrar Pendientes
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Saldo Actual</TableHead>
                {showPreviousMonth && <TableHead className="text-right">Mes Anterior</TableHead>}
                {showPending && <TableHead className="text-right">Pendientes</TableHead>}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const previousMonth = getPreviousMonthBalanceByAccount(account.name);
                const pending = getPendingByAccount(account.name);
                const accountTotal = account.balance + 
                  (showPreviousMonth ? previousMonth : 0) + 
                  (showPending ? pending : 0);

                return (
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
                    {showPreviousMonth && (
                      <TableCell className="text-right">
                        <span className={previousMonth >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {previousMonth.toFixed(2)}€
                        </span>
                      </TableCell>
                    )}
                    {showPending && (
                      <TableCell className="text-right">
                        <span className={pending >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {pending.toFixed(2)}€
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium">
                      <span className={accountTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {accountTotal.toFixed(2)}€
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-bold text-lg border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">
                  <span className={totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {totalBalance.toFixed(2)}€
                  </span>
                </TableCell>
                {showPreviousMonth && (
                  <TableCell className="text-right">
                    <span className={totalPreviousMonth >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {totalPreviousMonth.toFixed(2)}€
                    </span>
                  </TableCell>
                )}
                {showPending && (
                  <TableCell className="text-right">
                    <span className={totalPending >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {totalPending.toFixed(2)}€
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <span className={grandTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {grandTotal.toFixed(2)}€
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

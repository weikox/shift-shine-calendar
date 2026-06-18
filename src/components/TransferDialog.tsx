import { useState } from "react";
import { useFinances } from "@/contexts/FinancesContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TransferDialog = ({ open, onOpenChange }: TransferDialogProps) => {
  const { accounts, addTransfer, currentMonth } = useFinances();
  const [fromAccount, setFromAccount] = useState(accounts[0]?.name || "");
  const [toAccount, setToAccount] = useState(accounts[1]?.name || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (fromAccount === toAccount) {
      alert("Las cuentas de origen y destino no pueden ser iguales");
      return;
    }

    addTransfer({
      fromAccount,
      toAccount,
      amount: parseFloat(amount),
      date: currentMonth,
      note: note || undefined,
    });
    
    setAmount("");
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Traspaso entre cuentas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fromAccount">Desde</Label>
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.name} value={acc.name}>
                    {acc.name} ({acc.balance.toFixed(2)}€)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="toAccount">Hacia</Label>
            <Select value={toAccount} onValueChange={setToAccount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.name} value={acc.name}>
                    {acc.name} ({acc.balance.toFixed(2)}€)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Cantidad (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Concepto del traspaso..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Realizar Traspaso</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from "react";
import { useFinances, Transaction } from "@/contexts/FinancesContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Upload, X, Eye, Camera, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { createWorker } from 'tesseract.js';
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Transaction['category'];
  transactionId?: string;
}

export const TransactionDialog = ({ open, onOpenChange, category, transactionId }: TransactionDialogProps) => {
  const { transactions, addTransaction, updateTransaction, accounts, currentMonth } = useFinances();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState(accounts[0]?.name || "");
  const [executed, setExecuted] = useState(false);
  const [transactionDate, setTransactionDate] = useState<Date>(() => new Date());
  const [periodicity, setPeriodicity] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type: string; data: string }>>([]);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [processingOCR, setProcessingOCR] = useState(false);

  useEffect(() => {
    if (transactionId) {
      const transaction = transactions.find(t => t.id === transactionId);
      if (transaction) {
        setName(transaction.name);
        setAmount(transaction.amount.toString());
        setAccount(transaction.account);
        setExecuted(transaction.executed);
        // Parse existing date - can be YYYY-MM or YYYY-MM-DD
        if (transaction.date) {
          try {
            if (transaction.date.length === 7) {
              // YYYY-MM format - use first day of month
              setTransactionDate(parse(transaction.date + "-01", "yyyy-MM-dd", new Date()));
            } else {
              setTransactionDate(parse(transaction.date, "yyyy-MM-dd", new Date()));
            }
          } catch {
            setTransactionDate(new Date());
          }
        }
        if (transaction.periodicity) setPeriodicity(transaction.periodicity);
        if (transaction.documents) setDocuments(transaction.documents);
      }
    } else {
      resetForm();
    }
  }, [transactionId, transactions]);

  const resetForm = () => {
    setName("");
    setAmount("");
    setAccount(accounts[0]?.name || "");
    setExecuted(false);
    setTransactionDate(new Date());
    setPeriodicity('monthly');
    setDocuments([]);
  };

  const processImageWithOCR = async (imageData: string) => {
    if (!name && !amount) {
      setProcessingOCR(true);
      toast.info('Procesando documento con OCR...');
      
      let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
      try {
        // tesseract.js v7 API: createWorker con idioma
        worker = await createWorker('spa');
        const result = await worker.recognize(imageData);
        
        const text = result.data.text;
        
        // Buscar cantidad (euros)
        const amountMatch = text.match(/(\d+[.,]\d{2})\s*€?/);
        if (amountMatch && !amount) {
          const foundAmount = amountMatch[1].replace(',', '.');
          setAmount(foundAmount);
          toast.success(`Cantidad detectada: ${foundAmount}€`);
        }
        
        // Buscar posible nombre/concepto (primera línea no vacía)
        if (!name) {
          const lines = text.split('\n').filter(line => line.trim().length > 3);
          if (lines.length > 0) {
            setName(lines[0].trim());
            toast.success(`Concepto sugerido: ${lines[0].trim()}`);
          }
        }
      } catch (error) {
        console.error('Error en OCR:', error);
        toast.error('No se pudo leer el documento automáticamente');
      } finally {
        if (worker) await worker.terminate();
        setProcessingOCR(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} es demasiado grande (máx 5MB)`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const newDoc = {
          id: `${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          data: event.target?.result as string,
        };
        setDocuments(prev => [...prev, newDoc]);
        
        // Si es imagen y el formulario está vacío, intentar OCR
        if (file.type.startsWith('image/')) {
          await processImageWithOCR(newDoc.data);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const transactionData = {
      name: name.trim(),
      amount: parseFloat(amount),
      account,
      executed,
      category,
      date: format(transactionDate, "yyyy-MM-dd"),
      ...(category === 'periodic' && { periodicity }),
      documents: documents.length > 0 ? documents : undefined,
    };

    if (transactionId) {
      updateTransaction(transactionId, transactionData);
    } else {
      addTransaction(transactionData);
    }
    
    onOpenChange(false);
    resetForm();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {transactionId ? 'Editar' : 'Añadir'} {category === 'income' ? 'Ingreso' : 'Gasto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
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
              <Label htmlFor="account">Cuenta</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.name} value={acc.name}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
            </div>

            <div>
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !transactionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {transactionDate ? format(transactionDate, "d 'de' MMMM, yyyy", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={transactionDate}
                    onSelect={(date) => date && setTransactionDate(date)}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {category === 'periodic' && (
              <div>
                <Label htmlFor="periodicity">Periodicidad</Label>
                <Select value={periodicity} onValueChange={(v: any) => setPeriodicity(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="executed"
                checked={executed}
                onCheckedChange={(checked) => setExecuted(checked as boolean)}
              />
              <Label htmlFor="executed">Ejecutado</Label>
            </div>

            <div>
              <Label>Documentos adjuntos {processingOCR && "(Procesando OCR...)"}</Label>
              <div className="mt-2 space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm truncate flex-1">{doc.name}</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingDoc(doc.data)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocument(doc.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded cursor-pointer hover:bg-accent">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">Cámara</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded cursor-pointer hover:bg-accent">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Archivo</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {transactionId ? 'Actualizar' : 'Añadir'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {viewingDoc && (
        <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Vista previa del documento</DialogTitle>
            </DialogHeader>
            <div className="overflow-auto">
              {viewingDoc.startsWith('data:image') ? (
                <img src={viewingDoc} alt="Documento" className="max-w-full h-auto" />
              ) : viewingDoc.startsWith('data:application/pdf') ? (
                <iframe src={viewingDoc} className="w-full h-[70vh]" />
              ) : (
                <p>No se puede previsualizar este tipo de archivo</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

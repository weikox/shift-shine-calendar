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
import { Progress } from "@/components/ui/progress";
import { Upload, X, Eye, Camera, CalendarIcon, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { createWorker } from 'tesseract.js';
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useDocumentStorage, CloudDocument } from "@/hooks/useDocumentStorage";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { generateAutoTicket, getDeviceLocation, reverseGeocode } from "@/utils/generateAutoTicket";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Transaction['category'];
  transactionId?: string;
}

interface LocalDocument {
  id: string;
  name: string;
  type: string;
  data: string;
}

type DocumentItem = CloudDocument | LocalDocument;

const isCloudDocument = (doc: DocumentItem): doc is CloudDocument => {
  return 'storagePath' in doc;
};

export const TransactionDialog = ({ open, onOpenChange, category, transactionId }: TransactionDialogProps) => {
  const { transactions, addTransaction, updateTransaction, accounts, currentMonth } = useFinances();
  const { storageMethod } = useStorageMethod();
  const { uploadDocument, deleteDocument, getDocuments, getDocumentUrl, uploadProgress } = useDocumentStorage();
  
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState(accounts[0]?.name || "");
  const [executed, setExecuted] = useState(false);
  const [transactionDate, setTransactionDate] = useState<Date>(() => new Date());
  const [periodicity, setPeriodicity] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [selectedCategory, setSelectedCategory] = useState<Transaction['category']>(category);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [autoTicket, setAutoTicket] = useState(false);
  const [generatingTicket, setGeneratingTicket] = useState(false);

  const isCloudMode = storageMethod === 'cloud' || storageMethod === 'hybrid';
  
  // Sync selectedCategory when category prop changes (for new transactions)
  useEffect(() => {
    if (!transactionId) {
      setSelectedCategory(category);
    }
  }, [category, transactionId]);

  useEffect(() => {
    const loadTransaction = async () => {
      if (transactionId) {
        const transaction = transactions.find(t => t.id === transactionId);
        if (transaction) {
          setName(transaction.name);
          setAmount(transaction.amount.toString());
          setAccount(transaction.account);
          setExecuted(transaction.executed);
          setSelectedCategory(transaction.category);
          
          if (transaction.date) {
            try {
              if (transaction.date.length === 7) {
                setTransactionDate(parse(transaction.date + "-01", "yyyy-MM-dd", new Date()));
              } else {
                setTransactionDate(parse(transaction.date, "yyyy-MM-dd", new Date()));
              }
            } catch {
              setTransactionDate(new Date());
            }
          }
          
          if (transaction.periodicity) setPeriodicity(transaction.periodicity);
          
          // Load documents based on storage mode
          if (isCloudMode) {
            setLoadingDocs(true);
            const cloudDocs = await getDocuments(transactionId);
            setDocuments(cloudDocs);
            setLoadingDocs(false);
          } else if (transaction.documents) {
            setDocuments(transaction.documents as LocalDocument[]);
          }
        }
      } else {
        resetForm();
      }
    };
    
    loadTransaction();
  }, [transactionId, transactions, isCloudMode]);

  const resetForm = () => {
    setName("");
    setAmount("");
    setAccount(accounts[0]?.name || "");
    setExecuted(false);
    setTransactionDate(new Date());
    setPeriodicity('monthly');
    setSelectedCategory(category);
    setDocuments([]);
    setAutoTicket(false);
  };

  const processImageWithOCR = async (imageData: string) => {
    if (!name && !amount) {
      setProcessingOCR(true);
      toast.info('Procesando documento con OCR...');
      
      let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
      try {
        worker = await createWorker('spa');
        const result = await worker.recognize(imageData);
        
        const text = result.data.text;
        
        const amountMatch = text.match(/(\d+[.,]\d{2})\s*€?/);
        if (amountMatch && !amount) {
          const foundAmount = amountMatch[1].replace(',', '.');
          setAmount(foundAmount);
          toast.success(`Cantidad detectada: ${foundAmount}€`);
        }
        
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

      if (isCloudMode && transactionId) {
        // Cloud mode: upload directly to storage
        const cloudDoc = await uploadDocument(file, transactionId);
        if (cloudDoc) {
          setDocuments(prev => [...prev, cloudDoc]);
          
          // Process OCR if it's an image
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              await processImageWithOCR(event.target?.result as string);
            };
            reader.readAsDataURL(file);
          }
        }
      } else {
        // Local mode or new transaction: store as base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          const newDoc: LocalDocument = {
            id: `${Date.now()}-${i}`,
            name: file.name,
            type: file.type,
            data: event.target?.result as string,
          };
          setDocuments(prev => [...prev, newDoc]);
          
          if (file.type.startsWith('image/')) {
            await processImageWithOCR(newDoc.data);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    
    // Reset input
    e.target.value = '';
  };

  const removeDocument = async (doc: DocumentItem) => {
    if (isCloudDocument(doc)) {
      const success = await deleteDocument(doc.id);
      if (success) {
        setDocuments(documents.filter(d => d.id !== doc.id));
      } else {
        toast.error("Error al eliminar documento");
      }
    } else {
      setDocuments(documents.filter(d => d.id !== doc.id));
    }
  };

  const viewDocument = async (doc: DocumentItem) => {
    if (isCloudDocument(doc)) {
      const url = await getDocumentUrl(doc.storagePath);
      if (url) {
        setViewingDoc(url);
      } else {
        toast.error("Error al obtener documento");
      }
    } else {
      setViewingDoc(doc.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate auto ticket if checked
    let allDocuments = [...documents];
    if (autoTicket && selectedCategory === 'daily') {
      setGeneratingTicket(true);
      try {
        toast.info("Obteniendo ubicación y generando ticket...");
        const location = await getDeviceLocation();
        const ticketFile = await generateAutoTicket({
          name: name.trim(),
          amount: parseFloat(amount) || 0,
          date: format(transactionDate, "d 'de' MMMM, yyyy", { locale: es }),
          account,
          location,
        });

        if (isCloudMode && transactionId) {
          const cloudDoc = await uploadDocument(ticketFile, transactionId);
          if (cloudDoc) allDocuments.push(cloudDoc);
        } else {
          // Store as base64 local document
          const reader = new FileReader();
          const localDoc = await new Promise<LocalDocument>((resolve) => {
            reader.onload = (event) => {
              resolve({
                id: `auto-ticket-${Date.now()}`,
                name: ticketFile.name,
                type: ticketFile.type,
                data: event.target?.result as string,
              });
            };
            reader.readAsDataURL(ticketFile);
          });
          allDocuments.push(localDoc);
        }
        toast.success("Auto ticket generado");
      } catch (error) {
        console.error("Error generating auto ticket:", error);
        toast.error("Error al generar auto ticket");
      } finally {
        setGeneratingTicket(false);
      }
    }

    // For local documents that need to be uploaded when creating new transaction
    const localDocs = allDocuments.filter((d): d is LocalDocument => !isCloudDocument(d));
    
    const transactionData = {
      name: name.trim(),
      amount: parseFloat(amount),
      account,
      executed,
      category: selectedCategory,
      date: format(transactionDate, "yyyy-MM-dd"),
      ...(selectedCategory === 'periodic' && { periodicity }),
      // Only include documents in local mode
      ...(!isCloudMode && localDocs.length > 0 && { documents: localDocs }),
    };

    if (transactionId) {
      updateTransaction(transactionId, transactionData);
    } else {
      const newId = addTransaction(transactionData);
      
      // Upload pending documents for new transaction in cloud mode
      if (isCloudMode && localDocs.length > 0 && newId) {
        for (const doc of localDocs) {
          // Convert base64 back to file
          const response = await fetch(doc.data);
          const blob = await response.blob();
          const file = new File([blob], doc.name, { type: doc.type });
          await uploadDocument(file, newId);
        }
      }
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
              {transactionId ? 'Editar' : 'Añadir'} {selectedCategory === 'income' ? 'Ingreso' : 'Gasto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="category">Categoría</Label>
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as Transaction['category'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Gasto Fijo</SelectItem>
                  <SelectItem value="periodic">Gasto Periódico</SelectItem>
                  <SelectItem value="extra">Gasto Extra</SelectItem>
                  <SelectItem value="daily">Gasto Diario</SelectItem>
                  <SelectItem value="income">Ingreso</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            {selectedCategory === 'periodic' && (
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

            {selectedCategory === 'daily' && (
              <div className="flex items-center space-x-2 p-3 rounded-md border border-dashed border-primary/40 bg-primary/5">
                <Checkbox
                  id="autoTicket"
                  checked={autoTicket}
                  onCheckedChange={(checked) => setAutoTicket(checked as boolean)}
                />
                <Receipt className="h-4 w-4 text-primary" />
                <Label htmlFor="autoTicket" className="text-sm cursor-pointer">
                  Generar auto ticket (ticket simulado con ubicación)
                </Label>
              </div>
            )}

            <div>
              <Label>
                Documentos adjuntos 
                {processingOCR && " (Procesando OCR...)"}
                {uploadProgress.uploading && " (Subiendo...)"}
              </Label>
              
              {uploadProgress.uploading && (
                <Progress value={uploadProgress.progress} className="mt-2" />
              )}
              
              <div className="mt-2 space-y-2">
                {loadingDocs ? (
                  <div className="flex items-center justify-center p-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cargando documentos...
                  </div>
                ) : (
                  <>
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm truncate flex-1">{doc.name}</span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDocument(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(doc)}
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
                          disabled={uploadProgress.uploading}
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
                          disabled={uploadProgress.uploading}
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadProgress.uploading || generatingTicket}>
                {generatingTicket ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generando ticket...</>
                ) : (
                  transactionId ? 'Actualizar' : 'Añadir'
                )}
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
              {viewingDoc.startsWith('data:image') || viewingDoc.includes('/storage/') ? (
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

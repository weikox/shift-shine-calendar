import { useRef, useState } from "react";
import { useFinances, Transaction } from "@/contexts/FinancesContext";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useDocumentStorage } from "@/hooks/useDocumentStorage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileImage, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Mapeo de códigos de cuenta presentes en el nombre del fichero -> nombre real de cuenta
const ACCOUNT_MAP: Record<string, string> = {
  C: "Contado",
  BE: "BBVA Espe",
  S: "Santander",
};

// Categorías válidas (UI). Los tickets en lote siempre se cargan como gastos diarios.
const DEFAULT_CATEGORY: Transaction["category"] = "daily";

interface ParsedTicket {
  file: File;
  date: string; // YYYY-MM-DD
  categoryLabel: string; // tal cual aparece en el nombre
  itemName: string;
  accountCode: string;
  accountName: string;
  amount: number;
  valid: boolean;
  error?: string;
}

const parseFileName = (file: File): ParsedTicket => {
  // Quitar extensión
  const base = file.name.replace(/\.[^/.]+$/, "");
  // Formato esperado: fecha-categoria-nombre-cuenta-cantidad
  // La fecha puede ser YYYY-MM-DD (con guiones) → tomamos los 3 primeros bloques como fecha
  const parts = base.split("-").map((p) => p.trim()).filter(Boolean);

  const fail = (error: string): ParsedTicket => ({
    file,
    date: "",
    categoryLabel: "",
    itemName: "",
    accountCode: "",
    accountName: "",
    amount: 0,
    valid: false,
    error,
  });

  if (parts.length < 5) {
    return fail("Formato incorrecto (faltan campos)");
  }

  let date = "";
  let rest: string[] = [];

  // Intento 1: fecha con 3 partes (YYYY-MM-DD)
  if (/^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1]) && /^\d{1,2}$/.test(parts[2])) {
    const y = parts[0];
    const m = parts[1].padStart(2, "0");
    const d = parts[2].padStart(2, "0");
    date = `${y}-${m}-${d}`;
    rest = parts.slice(3);
  } else if (/^\d{8}$/.test(parts[0])) {
    // Intento 2: fecha YYYYMMDD en un solo bloque
    date = `${parts[0].slice(0, 4)}-${parts[0].slice(4, 6)}-${parts[0].slice(6, 8)}`;
    rest = parts.slice(1);
  } else {
    return fail("Fecha no reconocida");
  }

  if (rest.length < 4) return fail("Formato incorrecto (faltan campos)");

  // Últimos dos campos: cuenta y cantidad
  const amountStr = rest[rest.length - 1].replace(",", ".");
  const accountCode = rest[rest.length - 2];
  const middle = rest.slice(0, rest.length - 2);
  if (middle.length < 2) return fail("Faltan categoría o nombre");

  const categoryLabel = middle[0];
  const itemName = middle.slice(1).join(" ");

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return fail("Cantidad inválida");

  const accountName = ACCOUNT_MAP[accountCode];
  if (!accountName) return fail(`Código de cuenta desconocido: ${accountCode}`);

  return {
    file,
    date,
    categoryLabel,
    itemName,
    accountCode,
    accountName,
    amount,
    valid: true,
  };
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const BulkTicketUpload = () => {
  const { addTransaction, accounts, updateTransaction } = useFinances();
  const { storageMethod } = useStorageMethod();
  const { uploadDocument } = useDocumentStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedTicket[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const items = files.map(parseFileName);
    setParsed(items);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeItem = (idx: number) => {
    setParsed((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImport = async () => {
    const validItems = parsed.filter((p) => p.valid);
    if (!validItems.length) {
      toast.error("No hay tickets válidos para importar");
      return;
    }

    setImporting(true);
    let imported = 0;
    let errors = 0;

    for (const item of validItems) {
      try {
        // Verificar que la cuenta existe (si no, avisamos pero seguimos)
        const accountExists = accounts.some((a) => a.name === item.accountName);
        if (!accountExists) {
          toast.warning(`Cuenta "${item.accountName}" no existe. Crea la cuenta antes.`);
          errors++;
          continue;
        }

        const name = `${item.categoryLabel} ${item.itemName}`.trim();

        // Documentos: si es local/hybrid guardamos en local; si cloud subimos al storage
        let localDocs: Transaction["documents"] = undefined;
        if (storageMethod === "local" || storageMethod === "hybrid") {
          const data = await fileToBase64(item.file);
          localDocs = [
            {
              id: crypto.randomUUID(),
              name: item.file.name,
              type: item.file.type || "image/jpeg",
              data,
            },
          ];
        }

        const newId = addTransaction({
          name,
          amount: item.amount,
          account: item.accountName,
          executed: true,
          category: DEFAULT_CATEGORY,
          date: item.date,
          documents: localDocs,
        });

        // Subida a la nube si procede
        if ((storageMethod === "cloud" || storageMethod === "hybrid") && newId) {
          try {
            await uploadDocument(item.file, newId);
          } catch (err) {
            console.error("Error subiendo documento", err);
          }
        }

        imported++;
      } catch (err) {
        console.error(err);
        errors++;
      }
    }

    setImporting(false);
    setParsed([]);
    if (imported) toast.success(`${imported} tickets importados`);
    if (errors) toast.error(`${errors} tickets con errores`);
  };

  const validCount = parsed.filter((p) => p.valid).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subida en lote de tickets</CardTitle>
        <CardDescription>
          Nombre del fichero: <code>fecha-categoria-nombre-cuenta-cantidad</code>.
          Cuentas: <strong>C</strong>=Contado, <strong>BE</strong>=BBVA Espe, <strong>S</strong>=Santander.
          Se crearán como gastos diarios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleFiles}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          <Upload className="h-4 w-4 mr-2" />
          Seleccionar tickets
        </Button>

        {parsed.length > 0 && (
          <>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {parsed.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2 border rounded-md text-xs ${
                    item.valid ? "" : "border-destructive/50 bg-destructive/5"
                  }`}
                >
                  {item.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <FileImage className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.file.name}</div>
                    {item.valid ? (
                      <div className="text-muted-foreground">
                        {item.date} · {item.categoryLabel} {item.itemName} · {item.accountName} · {item.amount.toFixed(2)}€
                      </div>
                    ) : (
                      <div className="text-destructive">{item.error}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeItem(idx)}
                    disabled={importing}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={handleImport}
              disabled={importing || validCount === 0}
            >
              {importing ? "Importando..." : `Importar ${validCount} ticket(s)`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

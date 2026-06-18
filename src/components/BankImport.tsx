import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useFinances } from "@/contexts/FinancesContext";
import { createBankTransactionKey, normalizeTabularRows, parseBankRows, parseCsvRows, ParsedBankTransaction } from "@/lib/bankImport";
import { categorizeDescription, loadCategorizationRules, CATEGORY_LABELS } from "@/lib/categorizationRules";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import * as XLSX from 'xlsx';

export const BankImport = () => {
  const { accounts, addTransaction, currentMonth, transactions } = useFinances();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedBankTransaction[]>([]);
  const [detectedFormat, setDetectedFormat] = useState("");
  const [skippedRows, setSkippedRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rules = useMemo(() => loadCategorizationRules(), [parsedData]);

  const categorizeFor = (trans: ParsedBankTransaction) =>
    trans.type === "income" ? "income" : categorizeDescription(trans.description, rules);

  const existingKeys = useMemo(
    () =>
      new Set(
        transactions.map((transaction) =>
          createBankTransactionKey({
            account: transaction.account,
            date: transaction.date,
            description: transaction.name,
            amount: transaction.amount,
          })
        )
      ),
    [transactions]
  );

  const newTransactions = useMemo(
    () =>
      selectedAccount
        ? parsedData.filter((transaction) =>
            !existingKeys.has(createBankTransactionKey({ ...transaction, account: selectedAccount }))
          )
        : parsedData,
    [existingKeys, parsedData, selectedAccount]
  );

  const duplicateCount = Math.max(parsedData.length - newTransactions.length, 0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let parsed: ParsedBankTransaction[] = [];
          let format = "";
          let skipped = 0;

          if (file.name.endsWith('.csv')) {
            const text = data as string;
            const result = parseBankRows(parseCsvRows(text), currentMonth);
            parsed = result.transactions;
            format = result.detectedFormat;
            skipped = result.skippedRows;
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
            const jsonData = normalizeTabularRows(rawRows);
            const result = parseBankRows(jsonData, currentMonth);
            parsed = result.transactions;
            format = result.detectedFormat;
            skipped = result.skippedRows;
          }

          setParsedData(parsed);
          setDetectedFormat(format);
          setSkippedRows(skipped);
          toast.success(`${parsed.length} movimientos detectados`);
        } catch (error) {
          console.error('Error parsing file:', error);
          toast.error('Error al procesar el archivo');
        } finally {
          setLoading(false);
        }
      };

      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Error al leer el archivo');
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!selectedAccount) {
      toast.error('Selecciona una cuenta');
      return;
    }

    if (newTransactions.length === 0) {
      toast.error('No hay movimientos nuevos para importar');
      return;
    }

    let imported = 0;
    newTransactions.forEach(trans => {
      addTransaction({
        name: trans.description,
        amount: trans.amount,
        account: selectedAccount,
        executed: true,
        category: categorizeFor(trans),
        date: trans.date,
      });
      imported++;
    });

    toast.success(`${imported} movimientos nuevos importados`);
    setParsedData([]);
    setSelectedAccount("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar desde Banco
        </CardTitle>
        <CardDescription>
          Sube un extracto bancario en formato CSV o Excel para importar transacciones automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Cuenta de destino</label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una cuenta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(account => (
                <SelectItem key={account.name} value={account.name}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="bank-file-upload"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {loading ? 'Procesando...' : 'Subir archivo CSV/Excel'}
          </Button>
          <Link to="/cuentas/reglas-categorizacion" className="block">
            <Button variant="ghost" size="sm" className="w-full">
              <Settings2 className="h-4 w-4 mr-2" />
              Reglas de categorización ({rules.length})
            </Button>
          </Link>
        </div>

        {parsedData.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Formato: {detectedFormat || "genérico"}</Badge>
              <Badge variant="outline">Nuevos: {newTransactions.length}</Badge>
              <Badge variant="outline">Ya registrados: {duplicateCount}</Badge>
              {skippedRows > 0 && <Badge variant="destructive">Omitidos: {skippedRows}</Badge>}
            </div>
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              <h3 className="font-medium mb-2">Vista previa ({newTransactions.length} movimientos nuevos)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newTransactions.slice(0, 10).map((trans, idx) => {
                    const cat = categorizeFor(trans);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{trans.date}</TableCell>
                        <TableCell>{trans.description}</TableCell>
                        <TableCell>
                          <Badge variant={cat === "income" ? "default" : "outline"}>
                            {cat === "income" ? "Ingreso" : CATEGORY_LABELS[cat]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={trans.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                            {trans.type === 'income' ? '+' : '-'}{trans.amount.toFixed(2)}€
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {newTransactions.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  Todos los movimientos del archivo ya están registrados
                </div>
              )}
              {newTransactions.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2">
                  ... y {newTransactions.length - 10} movimientos nuevos más
                </p>
              )}
            </div>

            <Button onClick={handleImport} className="w-full" disabled={!selectedAccount || newTransactions.length === 0}>
              Registrar {newTransactions.length} movimientos nuevos
            </Button>
          </>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium">Formatos soportados:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>CSV o Excel con columnas de fecha, concepto e importe</li>
            <li>Formatos con columnas separadas de cargo/abono</li>
            <li>Detecta movimientos ya registrados por cuenta, fecha, descripción e importe</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useFinances } from "@/contexts/FinancesContext";
import { createBankTransactionKey, parseBankRows, parseCsvRows, ParsedBankTransaction } from "@/lib/bankImport";
import * as XLSX from 'xlsx';

export const BankImport = () => {
  const { accounts, addTransaction, currentMonth, transactions } = useFinances();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedBankTransaction[]>([]);
  const [detectedFormat, setDetectedFormat] = useState("");
  const [skippedRows, setSkippedRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
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
        category: trans.type === 'income' ? 'income' : 'extra',
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
        </div>

        {parsedData.length > 0 && (
          <>
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              <h3 className="font-medium mb-2">Vista previa ({parsedData.length} transacciones)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 10).map((trans, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{trans.date}</TableCell>
                      <TableCell>{trans.description}</TableCell>
                      <TableCell className="text-right">
                        <span className={trans.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {trans.type === 'income' ? '+' : '-'}{trans.amount.toFixed(2)}€
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2">
                  ... y {parsedData.length - 10} transacciones más
                </p>
              )}
            </div>

            <Button onClick={handleImport} className="w-full" disabled={!selectedAccount}>
              Importar {parsedData.length} transacciones
            </Button>
          </>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium">Formatos soportados:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>CSV con columnas: Fecha, Descripción, Cantidad</li>
            <li>Excel (.xlsx, .xls) con las mismas columnas</li>
            <li>Exportaciones de BBVA, Santander, CaixaBank, etc.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

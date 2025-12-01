import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useFinances, Transaction } from "@/contexts/FinancesContext";
import * as XLSX from 'xlsx';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
}

export const BankImport = () => {
  const { accounts, addTransaction, currentMonth } = useFinances();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let parsed: ParsedTransaction[] = [];

          if (file.name.endsWith('.csv')) {
            // Parse CSV
            const text = data as string;
            parsed = parseCSV(text);
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // Parse Excel
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            parsed = parseExcel(jsonData);
          }

          setParsedData(parsed);
          toast.success(`${parsed.length} transacciones encontradas`);
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

  const parseCSV = (text: string): ParsedTransaction[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const transactions: ParsedTransaction[] = [];

    // Skip header and parse data
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,;]/);
      
      if (values.length >= 3) {
        const date = values[0]?.trim();
        const description = values[1]?.trim();
        const amountStr = values[2]?.trim().replace(/[^\d,.-]/g, '').replace(',', '.');
        const amount = parseFloat(amountStr);

        if (date && description && !isNaN(amount)) {
          transactions.push({
            date: formatDate(date),
            description,
            amount: Math.abs(amount),
            type: amount >= 0 ? 'income' : 'expense',
          });
        }
      }
    }

    return transactions;
  };

  const parseExcel = (data: any[]): ParsedTransaction[] => {
    const transactions: ParsedTransaction[] = [];

    data.forEach(row => {
      const keys = Object.keys(row);
      const date = row[keys[0]];
      const description = row[keys[1]];
      const amount = parseFloat(String(row[keys[2]]).replace(/[^\d,.-]/g, '').replace(',', '.'));

      if (date && description && !isNaN(amount)) {
        transactions.push({
          date: formatDate(String(date)),
          description: String(description),
          amount: Math.abs(amount),
          type: amount >= 0 ? 'income' : 'expense',
        });
      }
    });

    return transactions;
  };

  const formatDate = (dateStr: string): string => {
    // Try to parse common date formats
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/,  // DD/MM/YYYY
      /(\d{4})-(\d{2})-(\d{2})/,     // YYYY-MM-DD
      /(\d{2})-(\d{2})-(\d{4})/,     // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0] || format === formats[2]) {
          // DD/MM/YYYY or DD-MM-YYYY
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else {
          // YYYY-MM-DD
          return dateStr;
        }
      }
    }

    return currentMonth + '-01';
  };

  const handleImport = () => {
    if (!selectedAccount) {
      toast.error('Selecciona una cuenta');
      return;
    }

    if (parsedData.length === 0) {
      toast.error('No hay transacciones para importar');
      return;
    }

    let imported = 0;
    parsedData.forEach(trans => {
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

    toast.success(`${imported} transacciones importadas`);
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

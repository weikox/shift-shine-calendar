import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Download, Upload, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCalendar } from "@/contexts/CalendarContext";
import { useFinances } from "@/contexts/FinancesContext";
import { useStorageMethod } from "@/hooks/useStorageMethod";

interface GlobalBackupData {
  version: string;
  exportedAt: string;
  calendar: {
    days: Record<string, any>;
    config: any;
  };
  finances: {
    accounts: any[];
    transactions: any[];
    transfers: any[];
  };
  notes: {
    pizarra: string;
    nevera: string;
  };
  settings: {
    storageMethod: string;
    autoSync: boolean;
  };
}

export function GlobalBackup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { days, config, importData: importCalendarData } = useCalendar();
  const { accounts, transactions, transfers, importData: importFinancesData } = useFinances();
  const { storageMethod } = useStorageMethod();

  const exportAllData = async () => {
    setIsExporting(true);
    try {
      // Get notes from localStorage or cloud
      let pizarraContent = "";
      let neveraContent = "";
      let autoSync = true;

      if (storageMethod === "local") {
        pizarraContent = localStorage.getItem("pizarra-content") || "";
        neveraContent = localStorage.getItem("nevera-content") || "";
        autoSync = localStorage.getItem("autoSync") === "true";
      } else {
        // Try to get from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: notesData } = await supabase
            .from("notes")
            .select("*")
            .eq("user_id", user.id);
          
          if (notesData) {
            const pizarraNote = notesData.find(n => n.type === "pizarra");
            const neveraNote = notesData.find(n => n.type === "nevera");
            pizarraContent = pizarraNote?.content || "";
            neveraContent = neveraNote?.content || "";
          }

          const { data: settingsData } = await supabase
            .from("app_settings")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (settingsData) {
            autoSync = settingsData.auto_sync ?? true;
          }
        }
      }

      const backupData: GlobalBackupData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        calendar: {
          days,
          config,
        },
        finances: {
          accounts,
          transactions,
          transfers,
        },
        notes: {
          pizarra: pizarraContent,
          nevera: neveraContent,
        },
        settings: {
          storageMethod,
          autoSync,
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-completo-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup completo exportado correctamente");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Error al exportar los datos");
    } finally {
      setIsExporting(false);
    }
  };

  const parseCSVFinances = (csvText: string): { transactions: Transaction[], accounts: AccountBalance[] } => {
    const lines = csvText.trim().split('\n');
    const transactions: Transaction[] = [];
    const accountSet = new Set<string>();
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Parse CSV with quoted fields
      const matches = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g);
      if (!matches || matches.length < 6) continue;
      
      const cleanField = (field: string) => {
        let cleaned = field.replace(/^,/, '').trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.slice(1, -1).replace(/""/g, '"');
        }
        return cleaned;
      };
      
      const name = cleanField(matches[0]);
      const amount = parseFloat(cleanField(matches[1]));
      const account = cleanField(matches[2]);
      const category = cleanField(matches[3]) as Transaction['category'];
      const executed = cleanField(matches[4]) === 'true';
      const date = cleanField(matches[5]);
      
      if (name && !isNaN(amount) && account && category && date) {
        accountSet.add(account);
        transactions.push({
          id: `import-${Date.now()}-${i}`,
          name,
          amount,
          account,
          category,
          executed,
          date,
        });
      }
    }
    
    const accounts: AccountBalance[] = Array.from(accountSet).map(name => ({ name, balance: 0 }));
    return { transactions, accounts };
  };

  interface Transaction {
    id: string;
    name: string;
    amount: number;
    account: string;
    category: 'fixed' | 'periodic' | 'extra' | 'daily' | 'income';
    executed: boolean;
    date: string;
  }

  interface AccountBalance {
    name: string;
    balance: number;
  }

  const importAllData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const isCSV = file.name.endsWith('.csv') || text.trim().startsWith('Nombre,');
      
      let data: GlobalBackupData;
      
      if (isCSV) {
        // Parse CSV file (finances export)
        const { transactions: csvTransactions, accounts: csvAccounts } = parseCSVFinances(text);
        data = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          calendar: { days: {}, config: {} },
          finances: {
            accounts: csvAccounts,
            transactions: csvTransactions,
            transfers: [],
          },
          notes: { pizarra: "", nevera: "" },
          settings: { storageMethod: "local", autoSync: true },
        };
      } else {
        data = JSON.parse(text);
        // Validate structure for JSON
        if (!data.version || !data.calendar || !data.finances) {
          throw new Error("Formato de backup inválido");
        }
      }

      // Import calendar data
      if (data.calendar.days && data.calendar.config) {
        const calendarExport = {
          days: data.calendar.days,
          config: data.calendar.config,
          events: Object.values(data.calendar.days)
            .flatMap((day: any) => day.events || []),
        };
        importCalendarData(JSON.stringify(calendarExport));
      }

      // Import finances data
      if (data.finances.accounts && data.finances.transactions) {
        const financesExport = {
          accounts: data.finances.accounts,
          transactions: data.finances.transactions,
          transfers: data.finances.transfers || [],
        };
        await importFinancesData(JSON.stringify(financesExport));
      }

      // Import notes
      if (data.notes) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (storageMethod === "local" || !user) {
          if (data.notes.pizarra) {
            localStorage.setItem("pizarra-content", data.notes.pizarra);
          }
          if (data.notes.nevera) {
            localStorage.setItem("nevera-content", data.notes.nevera);
          }
        } else if (user) {
          // Update notes in Supabase
          for (const noteType of ["pizarra", "nevera"] as const) {
            const content = data.notes[noteType];
            if (content !== undefined) {
              const { data: existing } = await supabase
                .from("notes")
                .select("id")
                .eq("user_id", user.id)
                .eq("type", noteType)
                .maybeSingle();

              if (existing) {
                await supabase
                  .from("notes")
                  .update({ content, updated_at: new Date().toISOString() })
                  .eq("id", existing.id);
              } else {
                await supabase
                  .from("notes")
                  .insert({ user_id: user.id, type: noteType, content });
              }
            }
          }
        }
      }

      toast.success("Backup importado correctamente. Recarga la página para ver todos los cambios.");
      setIsOpen(false);
    } catch (error) {
      console.error("Error importing data:", error);
      toast.error("Error al importar el backup. Verifica que el archivo sea válido.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="absolute top-6 right-6">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configuración Global</SheetTitle>
          <SheetDescription>
            Exporta o importa todos los datos de la aplicación
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Download className="h-5 w-5" />
                Exportar Backup Completo
              </CardTitle>
              <CardDescription>
                Descarga un archivo con todos tus datos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Turnos y notas del calendario</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Eventos y recordatorios</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Festivos configurados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Cuentas y transacciones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Transferencias</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Notas de Pizarra y Nevera</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Configuraciones</span>
                  </div>
                </div>
                <Button 
                  onClick={exportAllData} 
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? "Exportando..." : "Descargar Backup"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5" />
                Importar Backup
              </CardTitle>
              <CardDescription>
                Restaura todos tus datos desde un archivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-amber-700 dark:text-amber-300">
                    Los datos actuales serán reemplazados por los del backup
                  </span>
                </div>
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={importAllData}
                  className="hidden"
                  id="backup-import"
                  disabled={isImporting}
                />
                <Button 
                  variant="outline"
                  className="w-full"
                  disabled={isImporting}
                  onClick={() => document.getElementById("backup-import")?.click()}
                >
                  {isImporting ? "Importando..." : "Seleccionar Archivo"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

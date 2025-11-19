import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendar } from "@/contexts/CalendarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { EventsManager } from "@/components/EventsManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

const Config = () => {
  const navigate = useNavigate();
  const { config, updateConfig, exportData, importData } = useCalendar();
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const updatedHolidays = [
      ...config.holidays,
      { date: newHolidayDate, name: newHolidayName },
    ].sort((a, b) => a.date.localeCompare(b.date));

    updateConfig({ holidays: updatedHolidays });
    setNewHolidayDate("");
    setNewHolidayName("");
    toast.success("Festivo añadido correctamente");
  };

  const handleRemoveHoliday = (dateToRemove: string) => {
    const updatedHolidays = config.holidays.filter((h) => h.date !== dateToRemove);
    updateConfig({ holidays: updatedHolidays });
    toast.success("Festivo eliminado");
  };

  const handleExportData = (format: "json" | "csv" | "excel") => {
    const timestamp = new Date().toISOString().split("T")[0];

    if (format === "json") {
      const data = exportData();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calendario-backup-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Datos exportados en JSON");
    } else if (format === "csv" || format === "excel") {
      // Prepare data for spreadsheet
      const data = JSON.parse(exportData());
      const rows: any[] = [];

      // Export days with shifts and notes
      Object.entries(data.days).forEach(([date, dayData]: [string, any]) => {
        rows.push({
          Fecha: date,
          Turno: dayData.shift || "",
          Nota: dayData.note || "",
        });
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Calendario");

      if (format === "csv") {
        XLSX.writeFile(wb, `calendario-backup-${timestamp}.csv`);
        toast.success("Datos exportados en CSV");
      } else {
        XLSX.writeFile(wb, `calendario-backup-${timestamp}.xlsx`);
        toast.success("Datos exportados en Excel");
      }
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        importData(content);
      };
      reader.readAsText(file);
    } else if (fileExtension === "csv" || fileExtension === "xlsx") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Convert spreadsheet data to calendar format
          const days: Record<string, any> = {};
          jsonData.forEach((row: any) => {
            if (row.Fecha) {
              days[row.Fecha] = {
                shift: row.Turno || undefined,
                note: row.Nota || undefined,
              };
            }
          });

          importData(JSON.stringify({ days, config }));
        } catch (error) {
          toast.error("Error al importar archivo Excel/CSV");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato de archivo no soportado");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al calendario
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Events Manager */}
        <EventsManager />

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Ajustes de Visualización</CardTitle>
            <CardDescription>
              Personaliza el tamaño de las celdas del calendario si el ajuste automático no es óptimo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cell-size">Tamaño de celdas</Label>
              <Select
                value={config.cellSize}
                onValueChange={(value: "small" | "medium" | "large") =>
                  updateConfig({ cellSize: value })
                }
              >
                <SelectTrigger id="cell-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Pequeño</SelectItem>
                  <SelectItem value="medium">Medio (recomendado)</SelectItem>
                  <SelectItem value="large">Grande</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ajusta la altura de las celdas del calendario según tus preferencias
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Import/Export */}
        <Card>
          <CardHeader>
            <CardTitle>Importar / Exportar</CardTitle>
            <CardDescription>
              Guarda una copia de seguridad de tus datos en diferentes formatos o importa datos previamente exportados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Exportar datos</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button onClick={() => handleExportData("json")} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
                <Button onClick={() => handleExportData("csv")} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button onClick={() => handleExportData("excel")} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Importar datos</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,.xlsx"
                className="hidden"
                onChange={handleImportData}
                id="import-file"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar datos (JSON, CSV o Excel)
              </Button>
              <p className="text-xs text-muted-foreground">
                Soporta archivos .json, .csv y .xlsx
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card>
          <CardHeader>
            <CardTitle>Festivos</CardTitle>
            <CardDescription>
              Gestiona los días festivos que se mostrarán en el calendario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add new holiday */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="holiday-date">Fecha</Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holiday-name">Nombre</Label>
                  <Input
                    id="holiday-name"
                    placeholder="Ej: Día de Reyes"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleAddHoliday} className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Añadir festivo
              </Button>
            </div>

            {/* List of holidays */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                Festivos configurados ({config.holidays.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {config.holidays.map((holiday) => (
                  <div
                    key={holiday.date}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(holiday.date + "T00:00:00").toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveHoliday(holiday.date)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Leyenda de turnos</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-shift-morning rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-shift-morning-foreground">M</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Turno de Mañana</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-shift-afternoon rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-shift-afternoon-foreground">T</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Turno de Tarde</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-day-off rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-day-off-foreground">L</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Día Libre</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Config;

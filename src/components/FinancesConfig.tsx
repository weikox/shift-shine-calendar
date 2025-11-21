import { useRef } from "react";
import { useFinances } from "@/contexts/FinancesContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { toast } from "sonner";

interface FinancesConfigProps {
  onClose: () => void;
}

export const FinancesConfig = ({ onClose }: FinancesConfigProps) => {
  const { exportData, importData } = useFinances();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = (format: 'json' | 'csv' | 'xlsx') => {
    exportData(format);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        importData(content);
      } catch (error) {
        toast.error("Error al importar el archivo");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
            <p className="text-muted-foreground">Gestiona tus datos financieros</p>
          </div>
        </header>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exportar Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => handleExport('json')} className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar como JSON
              </Button>
              <Button onClick={() => handleExport('csv')} className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar como CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importar Datos</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleImport}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full"
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar desde archivo (JSON/CSV)
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Importa datos previamente exportados desde esta aplicación.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

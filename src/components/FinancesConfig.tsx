import { useRef, useState } from "react";
import { useFinances } from "@/contexts/FinancesContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Upload, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FinancesConfigProps {
  onClose: () => void;
}

export const FinancesConfig = ({ onClose }: FinancesConfigProps) => {
  const { exportData, importData, accounts, addAccount, updateAccount, deleteAccount } = useFinances();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");

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

  const handleAddAccount = () => {
    setEditingAccount(null);
    setAccountName("");
    setShowAccountDialog(true);
  };

  const handleEditAccount = (name: string) => {
    setEditingAccount(name);
    setAccountName(name);
    setShowAccountDialog(true);
  };

  const handleSaveAccount = () => {
    if (!accountName.trim()) {
      toast.error("El nombre de la cuenta no puede estar vacío");
      return;
    }

    if (editingAccount) {
      updateAccount(editingAccount, accountName.trim());
    } else {
      addAccount(accountName.trim());
    }
    
    setShowAccountDialog(false);
    setAccountName("");
    setEditingAccount(null);
  };

  const handleDeleteAccount = (name: string) => {
    if (confirm(`¿Estás seguro de eliminar la cuenta "${name}"?`)) {
      deleteAccount(name);
    }
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
              <div className="flex items-center justify-between">
                <CardTitle>Gestión de Cuentas</CardTitle>
                <Button onClick={handleAddAccount} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.name}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <span className="font-medium">{account.name}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditAccount(account.name)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAccount(account.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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

        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Cuenta" : "Nueva Cuenta"}
              </DialogTitle>
              <DialogDescription>
                {editingAccount 
                  ? "Modifica el nombre de la cuenta" 
                  : "Introduce el nombre de la nueva cuenta"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="accountName">Nombre de la cuenta</Label>
                <Input
                  id="accountName"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Ej: Banco Santander"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAccountDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAccount}>
                {editingAccount ? "Guardar" : "Añadir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const BankAggregatorConfig = () => {
  const [selectedBank, setSelectedBank] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!selectedBank || !username || !password) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    
    // Simulación - en producción esto requeriría integración con APIs bancarias
    setTimeout(() => {
      setLoading(false);
      toast.info("Funcionalidad en desarrollo. Requiere integración con Open Banking o APIs específicas de cada banco.");
    }, 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agregador Bancario</CardTitle>
        <CardDescription>
          Conecta tus cuentas bancarias para importar transacciones automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Nota:</strong> Esta funcionalidad requiere integración con APIs de Open Banking 
            (PSD2) o servicios de agregación bancaria como Plaid, Tink o Salt Edge. 
            Por seguridad, las credenciales bancarias nunca deben almacenarse directamente.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bank">Selecciona tu banco</Label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger>
                <SelectValue placeholder="Elige un banco..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bbva">BBVA</SelectItem>
                <SelectItem value="santander">Santander</SelectItem>
                <SelectItem value="caixabank">CaixaBank</SelectItem>
                <SelectItem value="sabadell">Sabadell</SelectItem>
                <SelectItem value="bankia">Bankia</SelectItem>
                <SelectItem value="ing">ING</SelectItem>
                <SelectItem value="n26">N26</SelectItem>
                <SelectItem value="revolut">Revolut</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="username">Usuario/Documento</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario del banco"
            />
          </div>

          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
            />
          </div>

          <Button 
            onClick={handleConnect} 
            disabled={loading}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {loading ? "Conectando..." : "Conectar Banco"}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Implementación Recomendada:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Usar servicios de Open Banking (PSD2) para acceso seguro</li>
            <li>Integrar APIs como Plaid, Tink o Salt Edge</li>
            <li>Implementar OAuth 2.0 para autenticación</li>
            <li>Nunca almacenar credenciales bancarias directamente</li>
            <li>Usar tokens de acceso con expiración</li>
            <li>Cumplir con regulaciones PSD2 y GDPR</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
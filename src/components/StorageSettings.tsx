import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { SyncButton } from "./SyncButton";

export function StorageSettings() {
  const { storageMethod, autoSync, updateStorageMethod, updateAutoSync } = useStorageMethod();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Método de Almacenamiento</CardTitle>
          <CardDescription>
            Elige cómo quieres guardar tus datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={storageMethod}
            onValueChange={(value) => updateStorageMethod(value as any)}
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="local" id="local" />
              <div className="space-y-1">
                <Label htmlFor="local" className="font-semibold">Solo Local</Label>
                <p className="text-sm text-muted-foreground">
                  Los datos se guardan únicamente en este dispositivo
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <RadioGroupItem 
                value="cloud" 
                id="cloud"
                disabled={!user}
              />
              <div className="space-y-1">
                <Label 
                  htmlFor="cloud" 
                  className={`font-semibold ${!user ? 'text-muted-foreground' : ''}`}
                >
                  Solo en la Nube
                </Label>
                <p className="text-sm text-muted-foreground">
                  Los datos se guardan solo en Lovable Cloud
                  {!user && " (requiere iniciar sesión)"}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <RadioGroupItem 
                value="hybrid" 
                id="hybrid"
                disabled={!user}
              />
              <div className="space-y-1">
                <Label 
                  htmlFor="hybrid" 
                  className={`font-semibold ${!user ? 'text-muted-foreground' : ''}`}
                >
                  Híbrido (Recomendado)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Copia local + sincronización con la nube
                  {!user && " (requiere iniciar sesión)"}
                </p>
              </div>
            </div>
          </RadioGroup>

          {user && (storageMethod === 'cloud' || storageMethod === 'hybrid') && (
            <>
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Sincronización Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Sincronizar cambios automáticamente
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={updateAutoSync}
                />
              </div>

              <div className="pt-4 border-t flex justify-center">
                <SyncButton />
              </div>
            </>
          )}

          {!user && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Para usar almacenamiento en la nube, necesitas iniciar sesión
              </p>
              <Button onClick={() => navigate("/auth")} className="w-full">
                Iniciar Sesión / Registrarse
              </Button>
            </div>
          )}

          {user && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sesión iniciada</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

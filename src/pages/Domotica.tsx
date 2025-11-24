import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Settings, Power, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Device {
  deviceid: string;
  name: string;
  online: boolean;
  params: {
    switch?: string;
    switches?: Array<{ switch: string; outlet: number }>;
  };
}

interface EwelinkConfig {
  email: string;
  password: string;
  region: string;
}

const Domotica = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<EwelinkConfig>({
    email: '',
    password: '',
    region: 'eu',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const saved = localStorage.getItem('ewelink-config');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  };

  const saveConfig = () => {
    localStorage.setItem('ewelink-config', JSON.stringify(config));
    setConfigOpen(false);
    toast.success('Configuración guardada');
    loadDevices();
  };

  const loadDevices = async () => {
    if (!config.email || !config.password) {
      toast.error('Configura primero tus credenciales de eWeLink');
      setConfigOpen(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ewelink', {
        body: {
          action: 'getDevices',
          email: config.email,
          password: config.password,
          region: config.region,
        },
      });

      if (error) throw error;
      
      if (data.success) {
        setDevices(data.data || []);
        toast.success('Dispositivos cargados');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error loading devices:', error);
      toast.error('Error al cargar dispositivos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDevice = async (deviceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ewelink', {
        body: {
          action: 'toggleDevice',
          email: config.email,
          password: config.password,
          region: config.region,
          deviceId,
        },
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success('Dispositivo actualizado');
        loadDevices();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error toggling device:', error);
      toast.error('Error al cambiar estado: ' + error.message);
    }
  };

  const getDeviceState = (device: Device): boolean => {
    if (device.params.switch) {
      return device.params.switch === 'on';
    }
    if (device.params.switches && device.params.switches.length > 0) {
      return device.params.switches[0].switch === 'on';
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Domótica</h1>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={loadDevices}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configuración eWeLink</DialogTitle>
                  <DialogDescription>
                    Introduce tus credenciales de eWeLink para controlar tus dispositivos
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={config.email}
                      onChange={(e) => setConfig({ ...config, email: e.target.value })}
                      placeholder="tu@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      value={config.password}
                      onChange={(e) => setConfig({ ...config, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Región</Label>
                    <Select
                      value={config.region}
                      onValueChange={(value) => setConfig({ ...config, region: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eu">Europa</SelectItem>
                        <SelectItem value="us">Estados Unidos</SelectItem>
                        <SelectItem value="cn">China</SelectItem>
                        <SelectItem value="as">Asia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={saveConfig} className="w-full">
                  Guardar y Conectar
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {devices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Power className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                No hay dispositivos conectados
              </p>
              <Button onClick={() => setConfigOpen(true)}>
                Configurar eWeLink
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <Card key={device.deviceid}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{device.name}</span>
                    <div className={`w-2 h-2 rounded-full ${device.online ? 'bg-green-500' : 'bg-red-500'}`} />
                  </CardTitle>
                  <CardDescription>
                    {device.online ? 'En línea' : 'Sin conexión'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {getDeviceState(device) ? 'Encendido' : 'Apagado'}
                    </span>
                    <Switch
                      checked={getDeviceState(device)}
                      onCheckedChange={() => toggleDevice(device.deviceid)}
                      disabled={!device.online}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Domotica;
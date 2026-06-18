import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Power, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import HomeAssistantPanel from "@/components/HomeAssistantPanel";
import Go2rtcPanel from "@/components/Go2rtcPanel";

interface Device {
  deviceid: string;
  name: string;
  online: boolean;
  params: {
    switch?: string;
    switches?: Array<{ switch: string; outlet: number }>;
  };
}

const Domotica = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingDevice, setTogglingDevice] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ewelink', {
        body: { action: 'getDevices' },
      });

      if (error) throw error;
      
      if (data.success) {
        setDevices(data.data || []);
        if (data.data?.length > 0) {
          toast.success(`${data.data.length} dispositivos cargados`);
        }
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
    setTogglingDevice(deviceId);
    try {
      const { data, error } = await supabase.functions.invoke('ewelink', {
        body: { action: 'toggleDevice', deviceId },
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success('Dispositivo actualizado');
        // Update local state optimistically
        setDevices(prev => prev.map(d => {
          if (d.deviceid === deviceId) {
            const currentState = getDeviceState(d);
            return {
              ...d,
              params: {
                ...d.params,
                switch: currentState ? 'off' : 'on'
              }
            };
          }
          return d;
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error toggling device:', error);
      toast.error('Error al cambiar estado: ' + error.message);
    } finally {
      setTogglingDevice(null);
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
          
        </div>

        <Tabs defaultValue="ha" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="ha">Home Assistant</TabsTrigger>
            <TabsTrigger value="cameras">Cámaras</TabsTrigger>
            <TabsTrigger value="ewelink">eWeLink</TabsTrigger>
          </TabsList>

          <TabsContent value="cameras">
            <Go2rtcPanel />
          </TabsContent>

          <TabsContent value="ha">
            <HomeAssistantPanel />
          </TabsContent>

          <TabsContent value="ewelink">
            <div className="flex justify-end mb-3">
              <Button variant="outline" size="icon" onClick={loadDevices} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {loading && devices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
                  <p className="text-muted-foreground text-center">Cargando dispositivos...</p>
                </CardContent>
              </Card>
            ) : devices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Power className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-4">No hay dispositivos conectados</p>
                  <Button onClick={loadDevices} disabled={loading}>Reintentar</Button>
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
                      <CardDescription>{device.online ? 'En línea' : 'Sin conexión'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {getDeviceState(device) ? 'Encendido' : 'Apagado'}
                        </span>
                        {togglingDevice === device.deviceid ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Switch
                            checked={getDeviceState(device)}
                            onCheckedChange={() => toggleDevice(device.deviceid)}
                            disabled={!device.online}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Domotica;

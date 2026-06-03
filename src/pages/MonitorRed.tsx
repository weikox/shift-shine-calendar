import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Device = {
  id: string;
  mac: string;
  ip: string | null;
  hostname: string | null;
  vendor: string | null;
  label: string | null;
  location: string | null;
  first_seen: string;
  last_seen: string;
  is_online: boolean;
};

type Session = {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
};

type RangeKey = "1d" | "7d" | "30d";

const RANGE_MS: Record<RangeKey, number> = {
  "1d": 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "30d": 30 * 24 * 3600 * 1000,
};

function uptimeMs(sessions: Session[], deviceId: string, from: number, to: number) {
  let total = 0;
  for (const s of sessions) {
    if (s.device_id !== deviceId) continue;
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : to;
    const a = Math.max(start, from);
    const b = Math.min(end, to);
    if (b > a) total += b - a;
  }
  return total;
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function MonitorRed() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<RangeKey>("1d");
  const [locationFilter, setLocationFilter] = useState<string>("__all__");
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - RANGE_MS["30d"]).toISOString();
      const [d, s] = await Promise.all([
        supabase.from("network_devices").select("*").order("is_online", { ascending: false }).order("last_seen", { ascending: false }),
        supabase
          .from("network_device_sessions")
          .select("id, device_id, started_at, ended_at")
          .gte("started_at", since)
          .order("started_at", { ascending: false }),
      ]);
      if (d.error) throw d.error;
      if (s.error) throw s.error;
      setDevices((d.data ?? []) as Device[]);
      setSessions((s.data ?? []) as Session[]);
    } catch (e: any) {
      toast.error("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const ch = supabase
      .channel("network-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "network_devices" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "network_device_sessions" }, load)
      .subscribe();
    return () => {
      clearInterval(tick);
      supabase.removeChannel(ch);
    };
  }, []);

  const locations = useMemo(() => {
    const set = new Set<string>();
    devices.forEach((d) => d.location && set.add(d.location));
    return Array.from(set).sort();
  }, [devices]);

  const filtered = useMemo(() => {
    if (locationFilter === "__all__") return devices;
    return devices.filter((d) => (d.location ?? "") === locationFilter);
  }, [devices, locationFilter]);

  const to = now;
  const from = to - RANGE_MS[range];

  const rows = useMemo(() => {
    return filtered
      .map((d) => {
        const up = uptimeMs(sessions, d.id, from, to);
        const pct = (up / (to - from)) * 100;
        return { device: d, up, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [filtered, sessions, from, to]);

  const startEdit = (d: Device) => {
    setEditing(d.id);
    setEditLabel(d.label ?? d.hostname ?? "");
  };

  const saveLabel = async (id: string) => {
    const { error } = await supabase
      .from("network_devices")
      .update({ label: editLabel.trim() || null })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
    } else {
      toast.success("Etiqueta guardada");
      setEditing(null);
      load();
    }
  };

  const onlineCount = filtered.filter((d) => d.is_online).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Monitor de red</h1>
              <p className="text-xs text-muted-foreground">
                {onlineCount} online / {filtered.length} dispositivos
              </p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4 flex flex-wrap items-center gap-3">
            <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <TabsList>
                <TabsTrigger value="1d">24h</TabsTrigger>
                <TabsTrigger value="7d">7 días</TabsTrigger>
                <TabsTrigger value="30d">30 días</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las sedes</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uptime por dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin dispositivos todavía. Inicia un agente para que aparezcan aquí.
              </p>
            ) : (
              <div className="space-y-3">
                {rows.map(({ device, up, pct }) => {
                  const name = device.label ?? device.hostname ?? device.ip ?? device.mac;
                  return (
                    <div key={device.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {device.is_online ? (
                            <Wifi className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          {editing === device.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <Input
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                className="h-7 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveLabel(device.id);
                                  if (e.key === "Escape") setEditing(null);
                                }}
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveLabel(device.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium truncate">{name}</span>
                              <button
                                onClick={() => startEdit(device)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              {device.location && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  {device.location}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                          <span className="hidden sm:inline">{fmtDuration(up)}</span>
                          <span className="font-mono w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            device.is_online ? "bg-green-500" : "bg-primary/60"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono">{device.ip ?? "—"} · {device.mac}</span>
                        <span>
                          {device.vendor ? device.vendor + " · " : ""}
                          visto hace {fmtRelative(device.last_seen)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Configuración del agente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>En tu <code className="text-xs">Iniciar-Monitor.bat</code> pon:</p>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`set "API_URL=https://uvuwkubxjfdvylxlcmpw.supabase.co/functions/v1/network-monitor"
set "UBICACION=Casa"`}
            </pre>
            <p className="text-xs text-muted-foreground">
              Los endpoints son idénticos al servidor de Replit, así que no necesitas tocar el
              <code className="mx-1">monitor.ps1</code>. Los datos llegan en tiempo real.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

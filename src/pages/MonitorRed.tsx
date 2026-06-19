import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Pencil, Check, X, Calendar as CalendarIcon, Smartphone, ChevronLeft, ChevronRight, Download, Archive, ArchiveRestore, Settings } from "lucide-react";
import SedeConfigDialog, { type SedeConfig } from "@/components/SedeConfigDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
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
  is_mobile: boolean;
  group_key: string | null;
  is_archived?: boolean;
};


type Session = {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function uptimeMs(sessions: Session[], deviceId: string, from: number, to: number) {
  let total = 0;
  for (const s of sessions) {
    if (s.device_id !== deviceId) continue;
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    const a = Math.max(start, from);
    const b = Math.min(end, to);
    if (b > a) total += b - a;
  }
  return total;
}

function deviceSegments(sessions: Session[], deviceId: string, from: number, to: number) {
  const segs: { start: number; end: number }[] = [];
  for (const s of sessions) {
    if (s.device_id !== deviceId) continue;
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    const a = Math.max(start, from);
    const b = Math.min(end, to);
    if (b > a) segs.push({ start: a, end: b });
  }
  return segs;
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
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

const DAY_MS = 24 * 3600 * 1000;

export default function MonitorRed() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [locationFilter, setLocationFilter] = useState<string>("__all__");
  const [mobileFilter, setMobileFilter] = useState<"all" | "mobile" | "fixed">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [, setTick] = useState(0);
  const loadTimer = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const [sedeConfigs, setSedeConfigs] = useState<SedeConfig[]>([]);
  const [configOpen, setConfigOpen] = useState(false);

  const loadSedeConfigs = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("network_sede_config")
      .select("location, fing_url, microcut_seconds");
    if (!error) setSedeConfigs((data ?? []) as SedeConfig[]);
  }, []);

  useEffect(() => {
    loadSedeConfigs();
  }, [loadSedeConfigs]);

  const globalMicrocutMs = useMemo(() => {
    const g = sedeConfigs.find((c) => c.location === "__global__");
    return (g?.microcut_seconds || 0) * 1000;
  }, [sedeConfigs]);



  const from = startOfDay(selectedDate).getTime();
  const to = from + DAY_MS;

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const sinceIso = new Date(from).toISOString();
      const untilIso = new Date(to).toISOString();
      const pageSize = 1000;
      let all: Session[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("network_device_sessions")
          .select("id, device_id, started_at, ended_at")
          .lt("started_at", untilIso)
          .or(`ended_at.is.null,ended_at.gte.${sinceIso}`)
          .order("started_at", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = (data ?? []) as Session[];
        all = all.concat(batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
        if (offset > 50000) break;
      }
      const d = await supabase
        .from("network_devices")
        .select("*")
        .order("is_online", { ascending: false })
        .order("last_seen", { ascending: false });
      if (d.error) throw d.error;
      setDevices((d.data ?? []) as Device[]);
      setSessions(all);
    } catch (e: any) {
      toast.error("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [from, to]);

  // Debounced load: many realtime events coalesce into a single fetch
  const scheduleLoad = useCallback(() => {
    if (loadTimer.current) window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => {
      loadTimer.current = null;
      load();
    }, 1500);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setTick((t) => t + 1), 30_000);
    const ch = supabase
      .channel("network-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "network_devices" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "network_device_sessions" }, scheduleLoad)
      .subscribe();
    return () => {
      clearInterval(tick);
      if (loadTimer.current) window.clearTimeout(loadTimer.current);
      supabase.removeChannel(ch);
    };
  }, [scheduleLoad]);


  const locations = useMemo(() => {
    const set = new Set<string>();
    devices.forEach((d) => d.location && set.add(d.location));
    return Array.from(set).sort();
  }, [devices]);

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      if (!showArchived && d.is_archived) return false;
      if (showArchived && !d.is_archived) return false;
      if (locationFilter !== "__all__" && (d.location ?? "") !== locationFilter) return false;
      if (mobileFilter === "mobile" && !d.is_mobile) return false;
      if (mobileFilter === "fixed" && d.is_mobile) return false;
      return true;
    });
  }, [devices, locationFilter, mobileFilter, showArchived]);


  const ipKey = (ip: string | null) => {
    if (!ip) return Number.MAX_SAFE_INTEGER;
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => isNaN(n))) return Number.MAX_SAFE_INTEGER;
    return parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3];
  };

  const mergeSegments = (segs: { start: number; end: number }[], gapToleranceMs = 0) => {
    if (segs.length === 0) return segs;
    const sorted = [...segs].sort((a, b) => a.start - b.start);
    const out: { start: number; end: number }[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const last = out[out.length - 1];
      const s = sorted[i];
      if (s.start - last.end <= gapToleranceMs) last.end = Math.max(last.end, s.end);
      else out.push({ ...s });
    }
    return out;
  };

  const rows = useMemo(() => {
    // Agrupar por group_key (si existe), si no, cada dispositivo es su propio grupo
    const groups = new Map<string, Device[]>();
    for (const d of filtered) {
      const k = d.group_key || `__id__:${d.id}`;
      const arr = groups.get(k) ?? [];
      arr.push(d);
      groups.set(k, arr);
    }
    return Array.from(groups.values())
      .map((members) => {
        // representativo: el de IP más baja
        const rep = [...members].sort((a, b) => ipKey(a.ip) - ipKey(b.ip))[0];
        const allSegs: { start: number; end: number }[] = [];
        for (const m of members) allSegs.push(...deviceSegments(sessions, m.id, from, to));
        const segs = mergeSegments(allSegs, globalMicrocutMs);
        const up = segs.reduce((acc, s) => acc + (s.end - s.start), 0);
        const pct = (up / DAY_MS) * 100;
        const isOnline = members.some((m) => m.is_online);
        return { device: rep, members, up, pct, segs, isOnline };
      })
      .sort((a, b) => ipKey(a.device.ip) - ipKey(b.device.ip));
  }, [filtered, sessions, from, to, globalMicrocutMs]);


  const startEdit = (d: Device) => {
    setEditing(d.id);
    setEditLabel(d.label ?? d.hostname ?? "");
  };

  const saveLabel = async (id: string) => {
    const { error } = await supabase
      .from("network_devices")
      .update({ label: editLabel.trim() || null })
      .eq("id", id);
    if (error) toast.error("No se pudo guardar: " + error.message);
    else {
      toast.success("Etiqueta guardada");
      setEditing(null);
      load();
    }
  };

  const toggleMobile = async (d: Device) => {
    const { error } = await supabase
      .from("network_devices")
      .update({ is_mobile: !d.is_mobile })
      .eq("id", d.id);
    if (error) toast.error("Error: " + error.message);
    else load();
  };


  const syncFing = async () => {
    setLoading(true);
    try {
      const isAll = locationFilter === "__all__";
      const { data, error } = await supabase.functions.invoke("fing-sync", {
        body: isAll
          ? { all: true }
          : { location: locationFilter },
      });
      if (error) throw error;
      toast.success(`Fing: ${data?.updated ?? 0} actualizados, ${data?.grouped ?? 0} agrupados`);
      await load();
    } catch (e: any) {
      toast.error("Error Fing: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const archiveDevice = async (d: Device, archive: boolean) => {
    const { error } = await supabase
      .from("network_devices")
      .update({ is_archived: archive })
      .eq("id", d.id);
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success(archive ? "Dispositivo archivado" : "Restaurado");
      load();
    }
  };


  const shiftDay = (delta: number) => {
    const n = new Date(selectedDate);
    n.setDate(n.getDate() + delta);
    setSelectedDate(startOfDay(n));
  };

  const onlineCount = filtered.filter((d) => d.is_online).length;
  const isToday = startOfDay(new Date()).getTime() === from;


  return (
    <div className="min-h-screen bg-background p-2 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold">Monitor de red</h1>
              <p className="text-xs text-muted-foreground">
                {onlineCount} online / {filtered.length} dispositivos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={syncFing} disabled={loading}>
              <Download className="h-4 w-4 mr-1" /> Fing
            </Button>
            <Button variant="outline" size="icon" onClick={() => setConfigOpen(true)} title="Configurar sedes">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <SedeConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          knownLocations={locations}
          onSaved={loadSedeConfigs}
        />

        <Card className="mb-4">
          <CardContent className="pt-2 pb-2 flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("min-w-[140px] md:min-w-[180px] justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "d MMM yyyy", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(startOfDay(d))}
                    initialFocus
                    locale={es}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={() => shiftDay(1)} disabled={isToday}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(startOfDay(new Date()))}>
                  Hoy
                </Button>
              )}
            </div>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[130px] md:w-[160px]">
                <SelectValue placeholder="Sede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las sedes</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={mobileFilter} onValueChange={(v) => setMobileFilter(v as any)}>
              <SelectTrigger className="w-[130px] md:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="mobile">Solo móviles</SelectItem>
                <SelectItem value="fixed">Solo fijos</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-xs cursor-pointer">
                {showArchived ? "Viendo archivados" : "Ver archivados"}
              </Label>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-3 md:p-6">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin dispositivos para los filtros seleccionados.
              </p>
            ) : (
              <div className="space-y-2 md:space-y-4">
                {rows.map(({ device, members, up, pct, segs, isOnline }) => {
                  const name = device.label ?? device.hostname ?? device.ip ?? device.mac;
                  const macCount = members.length;
                  return (
                    <div key={device.group_key || device.id} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isOnline ? (
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
                              <button onClick={() => startEdit(device)} className="text-muted-foreground hover:text-foreground">
                                <Pencil className="h-3 w-3" />
                              </button>
                              {device.is_mobile && (
                                <Smartphone className="h-3 w-3 text-primary" />
                              )}
                              {macCount > 1 && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5" title={members.map(m => m.mac).join("\n")}>
                                  {macCount} MACs
                                </Badge>
                              )}
                              {device.location && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  {device.location}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 md:gap-3 text-xs text-muted-foreground shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Switch
                              id={`mob-${device.id}`}
                              checked={device.is_mobile}
                              onCheckedChange={() => toggleMobile(device)}
                            />
                            <Label htmlFor={`mob-${device.id}`} className="text-[10px] cursor-pointer hidden sm:inline">
                              Móvil
                            </Label>
                          </div>
                          <button
                            onClick={() => archiveDevice(device, !device.is_archived)}
                            className="text-muted-foreground hover:text-foreground"
                            title={device.is_archived ? "Restaurar" : "Archivar (ya no existe)"}
                          >
                            {device.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </button>
                          <span className="hidden sm:inline">{fmtDuration(up)}</span>
                          <span className="font-mono w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>

                      </div>
                      <div className="relative h-2.5 md:h-4 w-full bg-muted rounded overflow-hidden">
                        {segs.map((s, i) => {
                          const left = ((s.start - from) / DAY_MS) * 100;
                          const width = ((s.end - s.start) / DAY_MS) * 100;
                          return (
                            <div
                              key={i}
                              className="absolute top-0 bottom-0 bg-green-500/80"
                              style={{ left: `${left}%`, width: `${Math.max(0.2, width)}%` }}
                              title={`${new Date(s.start).toLocaleTimeString()} – ${new Date(s.end).toLocaleTimeString()}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[9px] md:text-[10px] text-muted-foreground font-mono px-0.5">
                        {[0, 6, 12, 18].map((h) => (
                          <span key={h}>{String(h).padStart(2, "0")}</span>
                        ))}
                        <span>24</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground leading-tight">
                        <span className="font-mono truncate max-w-[55%]">{device.ip ?? "—"} · {device.mac}{macCount > 1 ? ` (+${macCount - 1})` : ""}</span>
                        <span className="truncate max-w-[45%] text-right">
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

        <Card className="mt-4 hidden md:block">
          <CardHeader>
            <CardTitle className="text-base">Configuración del agente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>En tu <code className="text-xs">Iniciar-Monitor.bat</code> pon:</p>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`set "API_URL=https://uvuwkubxjfdvylxlcmpw.supabase.co/functions/v1/network-monitor"
set "UBICACION=Casa"`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

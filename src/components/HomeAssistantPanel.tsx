import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Star, StarOff, Zap, Thermometer, Lightbulb, Power, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface HAEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
}

const FAV_KEY = "ha_favorites_v1";

const getDomain = (id: string) => id.split(".")[0];

const iconFor = (id: string) => {
  const d = getDomain(id);
  if (d === "light") return <Lightbulb className="h-4 w-4" />;
  if (d === "switch") return <Power className="h-4 w-4" />;
  if (d === "sensor" || d === "binary_sensor") return <Activity className="h-4 w-4" />;
  if (d === "climate") return <Thermometer className="h-4 w-4" />;
  return <Zap className="h-4 w-4" />;
};

const isToggleable = (id: string) => ["light", "switch", "fan", "input_boolean"].includes(getDomain(id));

export default function HomeAssistantPanel() {
  const [entities, setEntities] = useState<HAEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [favs, setFavs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
  });
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("home-assistant", {
        body: { action: "getStates" },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setEntities(data.data || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Error HA: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFav = (id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  };

  const callService = async (domain: string, service: string, entity_id: string, data?: any) => {
    setBusy(entity_id);
    try {
      const { data: res, error } = await supabase.functions.invoke("home-assistant", {
        body: { action: "callService", domain, service, entity_id, data },
      });
      if (error) throw error;
      if (!res.success) throw new Error(res.error);
      // Optimistic refresh
      setTimeout(load, 600);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = (e: HAEntity) => {
    const domain = getDomain(e.entity_id);
    callService(domain, "toggle", e.entity_id);
  };

  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    return entities
      .filter((e) => !showOnlyFavs || favs.includes(e.entity_id))
      .filter((e) => {
        if (!f) return true;
        const name = (e.attributes?.friendly_name || e.entity_id).toLowerCase();
        return name.includes(f) || e.entity_id.toLowerCase().includes(f);
      })
      .sort((a, b) => {
        const af = favs.includes(a.entity_id) ? 0 : 1;
        const bf = favs.includes(b.entity_id) ? 0 : 1;
        if (af !== bf) return af - bf;
        return (a.attributes?.friendly_name || a.entity_id).localeCompare(b.attributes?.friendly_name || b.entity_id);
      });
  }, [entities, filter, favs, showOnlyFavs]);

  const grouped = useMemo(() => {
    const g: Record<string, HAEntity[]> = {};
    filtered.forEach((e) => {
      const d = getDomain(e.entity_id);
      (g[d] = g[d] || []).push(e);
    });
    return g;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar entidad..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant={showOnlyFavs ? "default" : "outline"}
          size="sm"
          onClick={() => setShowOnlyFavs((v) => !v)}
        >
          <Star className="h-4 w-4 mr-1" /> Favoritos ({favs.length})
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} / {entities.length} entidades</span>
      </div>

      {loading && entities.length === 0 ? (
        <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sin entidades</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([domain, list]) => (
          <div key={domain}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">{domain} ({list.length})</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((e) => {
                const name = e.attributes?.friendly_name || e.entity_id;
                const isOn = e.state === "on";
                const unit = e.attributes?.unit_of_measurement;
                const power = e.attributes?.current_power_w ?? e.attributes?.power;
                const energy = e.attributes?.energy ?? e.attributes?.today_energy_kwh;
                return (
                  <Card key={e.entity_id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 truncate">
                          {iconFor(e.entity_id)}
                          <span className="truncate">{name}</span>
                        </span>
                        <button onClick={() => toggleFav(e.entity_id)} className="shrink-0">
                          {favs.includes(e.entity_id)
                            ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            : <StarOff className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </CardTitle>
                      <CardDescription className="text-[10px] truncate">{e.entity_id}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {isToggleable(e.entity_id) ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{isOn ? "Encendido" : "Apagado"}</span>
                          {busy === e.entity_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch checked={isOn} onCheckedChange={() => handleToggle(e)} />
                          )}
                        </div>
                      ) : (
                        <div className="text-sm">
                          <span className="font-semibold">{e.state}</span>
                          {unit && <span className="text-muted-foreground ml-1">{unit}</span>}
                        </div>
                      )}
                      {(power !== undefined || energy !== undefined) && (
                        <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
                          {power !== undefined && <span>⚡ {power} W</span>}
                          {energy !== undefined && <span>📊 {energy} kWh</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

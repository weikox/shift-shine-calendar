import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, RefreshCw, Play, Pause, Maximize2, X } from "lucide-react";
import { toast } from "sonner";

const CFG_KEY = "go2rtc_cfg_v1";

interface Cfg {
  baseUrl: string;
  streams: string[];
  intervalMs: number;
}

const DEFAULT_CFG: Cfg = {
  baseUrl: "https://nevera.dmoneo.ovh",
  streams: ["nevera", "dcs-6500lh samano", "dcs-8600lh samano", "dcs-6500lh zamakola"],
  intervalMs: 2000,
};

function loadCfg(): Cfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CFG;
}

function CameraTile({ baseUrl, stream, intervalMs, playing, onExpand }: {
  baseUrl: string; stream: string; intervalMs: number; playing: boolean; onExpand: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!playing || !stream) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || !imgRef.current) return;
      const u = `${baseUrl.replace(/\/$/, "")}/api/frame.jpeg?src=${encodeURIComponent(stream)}&_t=${Date.now()}`;
      imgRef.current.src = u;
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [baseUrl, stream, intervalMs, playing]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2 px-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm truncate">{stream}</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExpand}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0 bg-black aspect-video flex items-center justify-center">
        {err ? (
          <span className="text-xs text-destructive p-2">{err}</span>
        ) : (
          <img
            ref={imgRef}
            alt={stream}
            className="w-full h-full object-contain"
            onError={() => setErr("Error al cargar")}
            onLoad={() => setErr(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function Go2rtcPanel() {
  const [cfg, setCfg] = useState<Cfg>(loadCfg);
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const save = (next: Cfg) => {
    setCfg(next);
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
    toast.success("Configuración guardada");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant={playing ? "default" : "outline"} size="sm" onClick={() => setPlaying((v) => !v)}>
          {playing ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          {playing ? "Pausar" : "Reproducir"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
          <Settings className="h-4 w-4 mr-1" /> Configurar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {cfg.streams.filter(Boolean).length} cámaras · refresco {cfg.intervalMs}ms
        </span>
      </div>

      {editing && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label className="text-xs">URL base go2rtc</Label>
              <Input
                value={cfg.baseUrl}
                onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
                placeholder="https://nevera.dmoneo.ovh"
              />
            </div>
            <div>
              <Label className="text-xs">Refresco (ms)</Label>
              <Input
                type="number"
                value={cfg.intervalMs}
                onChange={(e) => setCfg({ ...cfg, intervalMs: Math.max(500, Number(e.target.value) || 2000) })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Nombres de stream (src= en go2rtc)</Label>
              {cfg.streams.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={s}
                    onChange={(e) => {
                      const next = [...cfg.streams]; next[i] = e.target.value;
                      setCfg({ ...cfg, streams: next });
                    }}
                  />
                  <Button variant="outline" size="icon" onClick={() => {
                    setCfg({ ...cfg, streams: cfg.streams.filter((_, j) => j !== i) });
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCfg({ ...cfg, streams: [...cfg.streams, ""] })}>
                + Añadir cámara
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setCfg(loadCfg()); setEditing(false); }}>Cancelar</Button>
              <Button onClick={() => { save(cfg); setEditing(false); }}>Guardar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-3">
        {cfg.streams.filter(Boolean).map((s) => (
          <CameraTile
            key={s}
            baseUrl={cfg.baseUrl}
            stream={s}
            intervalMs={cfg.intervalMs}
            playing={playing}
            onExpand={() => setExpanded(s)}
          />
        ))}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpanded(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setExpanded(null); }}
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <CameraTile
              baseUrl={cfg.baseUrl}
              stream={expanded}
              intervalMs={Math.max(500, cfg.intervalMs)}
              playing={playing}
              onExpand={() => setExpanded(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

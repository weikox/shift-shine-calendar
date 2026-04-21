import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, RefreshCw, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

type Corner = { x: number; y: number };
type Corners = [Corner, Corner, Corner, Corner];

const DEFAULT_CORNERS: Corners = [
  { x: 0.05, y: 0.05 },
  { x: 0.95, y: 0.05 },
  { x: 0.95, y: 0.95 },
  { x: 0.05, y: 0.95 },
];

const DEFAULT_SNAPSHOT_URL = "https://nevera.dmoneo.ovh/api/frame.jpeg?src=nevera";

function solveProjection(src: Corners, dst: Corners): number[] {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y, dx = dst[i].x, dy = dst[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
  }
  const n = 8, M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) return [1, 0, 0, 0, 1, 0, 0, 0];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;
    for (let row = 0; row < n; row++) { if (row === col) continue; const f = M[row][col]; for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j]; }
  }
  return M.map(row => row[n]);
}

function applyPerspective(h: number[], x: number, y: number): [number, number] {
  const w = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

function renderCorrected(img: HTMLImageElement, canvas: HTMLCanvasElement, corners: Corners) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const outW = canvas.width, outH = canvas.height, imgW = img.naturalWidth, imgH = img.naturalHeight;
  if (!imgW || !imgH) return;
  const srcPx = corners.map(c => ({ x: c.x * imgW, y: c.y * imgH })) as Corners;
  const dstPx: Corners = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }];
  const h = solveProjection(dstPx, srcPx);
  const tmp = document.createElement('canvas'); tmp.width = imgW; tmp.height = imgH;
  tmp.getContext('2d')!.drawImage(img, 0, 0);
  const src = tmp.getContext('2d')!.getImageData(0, 0, imgW, imgH);
  const out = ctx.createImageData(outW, outH);
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const [sx, sy] = applyPerspective(h, x, y);
    const si = Math.round(sx), sj = Math.round(sy), oi = (y * outW + x) * 4;
    if (si >= 0 && si < imgW && sj >= 0 && sj < imgH) {
      const ii = (sj * imgW + si) * 4;
      out.data[oi] = src.data[ii]; out.data[oi+1] = src.data[ii+1]; out.data[oi+2] = src.data[ii+2]; out.data[oi+3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

function drawConfigOverlay(canvas: HTMLCanvasElement, img: HTMLImageElement, corners: Corners, dragging: number | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.width, ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch); ctx.drawImage(img, 0, 0, cw, ch);
  ctx.beginPath();
  corners.forEach((c, i) => { const px = c.x * cw, py = c.y * ch; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
  ctx.closePath(); ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2; ctx.stroke();
  const labels = ['TL', 'TR', 'BR', 'BL'];
  corners.forEach((c, i) => {
    const px = c.x * cw, py = c.y * ch;
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = dragging === i ? '#ff0000' : '#00ff00'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#000'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(labels[i], px, py + 3);
  });
}

const Nevera = () => {
  const navigate = useNavigate();
  const { storageMethod } = useStorageMethod();
  const { user } = useAuth();
  const [configMode, setConfigMode] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(DEFAULT_SNAPSHOT_URL);
  const [corners, setCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const configCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const cornersRef = useRef(corners);
  cornersRef.current = corners;

  useEffect(() => {
    const loadConfig = async () => {
      const localConfig = localStorage.getItem('nevera-config');
      if (localConfig) {
        try {
          const parsed = JSON.parse(localConfig);
          if (parsed.corners) setCorners(parsed.corners);
          if (parsed.snapshotUrl) setSnapshotUrl(parsed.snapshotUrl);
          else if (parsed.embedUrl) setSnapshotUrl(parsed.embedUrl);
          if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
        } catch {}
      }
      if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
        try {
          const { data } = await supabase.from('notes').select('content').eq('user_id', user.id).eq('type', 'nevera-config').maybeSingle();
          if (data?.content) {
            const parsed = JSON.parse(data.content);
            if (parsed.corners) setCorners(parsed.corners);
            if (parsed.snapshotUrl) setSnapshotUrl(parsed.snapshotUrl);
            else if (parsed.embedUrl) setSnapshotUrl(parsed.embedUrl);
            if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
          }
        } catch (e) { console.error('Error loading config:', e); }
      }
    };
    loadConfig();
  }, [storageMethod, user]);

  const saveConfig = async () => {
    const config = JSON.stringify({ corners, snapshotUrl, refreshInterval });
    localStorage.setItem('nevera-config', config);
    if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
      try {
        await supabase.from('notes').upsert({ user_id: user.id, type: 'nevera-config', content: config }, { onConflict: 'user_id,type' });
      } catch (e) { console.error('Error saving config:', e); }
    }
    toast.success('Configuración guardada');
  };

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/camera-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
        body: JSON.stringify({ snapshotUrl }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const main = mainCanvasRef.current;
        if (main) {
          const container = mainContainerRef.current;
          if (container) { const w = container.clientWidth; const h = Math.min(w * 0.75, window.innerHeight - 120); main.width = w; main.height = h; }
          renderCorrected(img, main, cornersRef.current);
        }
        const preview = previewCanvasRef.current;
        if (preview) renderCorrected(img, preview, cornersRef.current);
        const configCanvas = configCanvasRef.current;
        if (configCanvas) drawConfigOverlay(configCanvas, img, cornersRef.current, null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (e) { console.error('Error fetching snapshot:', e); }
    finally { setLoading(false); }
  }, [snapshotUrl]);

  useEffect(() => {
    fetchSnapshot();
    intervalRef.current = setInterval(fetchSnapshot, refreshInterval * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refreshInterval, fetchSnapshot]);

  useEffect(() => {
    if (!configMode || !imageRef.current) return;
    const cc = configCanvasRef.current; if (cc) drawConfigOverlay(cc, imageRef.current, corners, dragging);
    const pc = previewCanvasRef.current; if (pc) renderCorrected(imageRef.current, pc, corners);
  }, [corners, configMode, dragging]);

  useEffect(() => {
    if (configMode) return;
    const resize = () => {
      const canvas = mainCanvasRef.current, container = mainContainerRef.current;
      if (!canvas || !container) return;
      const w = container.clientWidth, h = Math.min(w * 0.75, window.innerHeight - 120);
      canvas.width = w; canvas.height = h;
      if (imageRef.current) renderCorrected(imageRef.current, canvas, cornersRef.current);
    };
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [configMode]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { const p = getCanvasPos(e); for (let i = 0; i < 4; i++) { const dx = p.x - corners[i].x, dy = p.y - corners[i].y; if (Math.sqrt(dx*dx+dy*dy) < 0.04) { setDragging(i); return; } } };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (dragging === null) return; const p = getCanvasPos(e); const nc = [...corners] as Corners; nc[dragging] = { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) }; setCorners(nc); };
  const handleMouseUp = () => setDragging(null);
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); const t = e.touches[0]; return { x: (t.clientX - r.left) / r.width, y: (t.clientY - r.top) / r.height }; };
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); const p = getTouchPos(e); for (let i = 0; i < 4; i++) { const dx = p.x - corners[i].x, dy = p.y - corners[i].y; if (Math.sqrt(dx*dx+dy*dy) < 0.06) { setDragging(i); return; } } };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); if (dragging === null) return; const p = getTouchPos(e); const nc = [...corners] as Corners; nc[dragging] = { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) }; setCorners(nc); };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-2xl font-bold text-foreground">Nevera</h1>
          </div>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button variant={configMode ? "default" : "outline"} size="sm" onClick={() => setConfigMode(!configMode)} className="gap-2">
              {configMode ? <Eye className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              {configMode ? 'Ver' : 'Configurar'}
            </Button>
          </div>
        </div>

        {configMode ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL del snapshot (go2rtc)</Label>
              <Input value={snapshotUrl} onChange={(e) => setSnapshotUrl(e.target.value)} placeholder="https://go2rtc.example.com/api/frame.jpeg?src=nevera" />
            </div>
            <div className="space-y-2">
              <Label>Intervalo de refresco: {refreshInterval}s</Label>
              <Slider value={[refreshInterval]} onValueChange={([v]) => setRefreshInterval(v)} min={3} max={60} step={1} />
            </div>
            <p className="text-sm text-muted-foreground">Arrastra las esquinas verdes para ajustar el recorte de la pizarra:</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Imagen original</p>
                <canvas ref={configCanvasRef} width={640} height={480} className="w-full border rounded-lg cursor-crosshair touch-none"
                  onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={() => setDragging(null)} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Vista corregida</p>
                <canvas ref={previewCanvasRef} width={640} height={480} className="w-full border rounded-lg" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveConfig}>Guardar configuración</Button>
              <Button variant="outline" onClick={fetchSnapshot}><RefreshCw className="h-4 w-4 mr-2" />Actualizar imagen</Button>
              <Button variant="outline" onClick={() => setCorners(DEFAULT_CORNERS)}>Reiniciar esquinas</Button>
            </div>
          </div>
        ) : (
          <div ref={mainContainerRef}>
            <canvas ref={mainCanvasRef} className="w-full rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Nevera;

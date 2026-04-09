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

type Corner = { x: number; y: number };
type Corners = [Corner, Corner, Corner, Corner]; // TL, TR, BR, BL

const DEFAULT_CORNERS: Corners = [
  { x: 0.05, y: 0.05 },
  { x: 0.95, y: 0.05 },
  { x: 0.95, y: 0.95 },
  { x: 0.05, y: 0.95 },
];

const DEFAULT_EMBED_URL = "https://rtsp.me/embed/ZBbRS9ke/";

function solveProjection(src: Corners, dst: Corners): number[] {
  // Solve 8-parameter perspective transform: dst = H * src
  // Using DLT (Direct Linear Transform)
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y;
    const dx = dst[i].x, dy = dst[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }
  // Gaussian elimination
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) return [1, 0, 0, 0, 1, 0, 0, 0];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

function applyPerspective(h: number[], x: number, y: number): [number, number] {
  const w = h[6] * x + h[7] * y + 1;
  return [
    (h[0] * x + h[1] * y + h[2]) / w,
    (h[3] * x + h[4] * y + h[5]) / w,
  ];
}

const Nevera = () => {
  const navigate = useNavigate();
  const { storageMethod } = useStorageMethod();
  const { user } = useAuth();
  const [configMode, setConfigMode] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(DEFAULT_EMBED_URL);
  const [corners, setCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const configCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      const localConfig = localStorage.getItem('nevera-config');
      if (localConfig) {
        try {
          const parsed = JSON.parse(localConfig);
          if (parsed.corners) setCorners(parsed.corners);
          if (parsed.embedUrl) setEmbedUrl(parsed.embedUrl);
          if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
        } catch {}
      }

      if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
        try {
          const { data } = await supabase
            .from('notes')
            .select('content')
            .eq('user_id', user.id)
            .eq('type', 'nevera-config')
            .maybeSingle();
          if (data?.content) {
            const parsed = JSON.parse(data.content);
            if (parsed.corners) setCorners(parsed.corners);
            if (parsed.embedUrl) setEmbedUrl(parsed.embedUrl);
            if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
          }
        } catch (e) {
          console.error('Error loading config:', e);
        }
      }
    };
    loadConfig();
  }, [storageMethod, user]);

  const saveConfig = async () => {
    const config = JSON.stringify({ corners, embedUrl, refreshInterval });
    localStorage.setItem('nevera-config', config);

    if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
      try {
        await supabase.from('notes').upsert({
          user_id: user.id,
          type: 'nevera-config',
          content: config,
        }, { onConflict: 'user_id,type' });
      } catch (e) {
        console.error('Error saving config:', e);
      }
    }
    toast.success('Configuración guardada');
  };

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('camera-snapshot', {
        body: { embedUrl },
      });

      if (error) throw error;

      // data is the raw image response
      const blob = new Blob([data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        drawOutput();
        if (configMode) drawConfig();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (e) {
      console.error('Error fetching snapshot:', e);
    } finally {
      setLoading(false);
    }
  }, [embedUrl, corners, configMode]);

  const drawOutput = useCallback(() => {
    const img = imageRef.current;
    const canvas = outputCanvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outW = canvas.width;
    const outH = canvas.height;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    // Source corners in pixel coords
    const srcPx: Corners = corners.map(c => ({ x: c.x * imgW, y: c.y * imgH })) as Corners;
    // Destination is the full output rectangle
    const dstPx: Corners = [
      { x: 0, y: 0 },
      { x: outW, y: 0 },
      { x: outW, y: outH },
      { x: 0, y: outH },
    ];

    // We need the inverse transform: for each output pixel, find source pixel
    const h = solveProjection(dstPx, srcPx);

    // Draw source image to hidden canvas to get pixel data
    const srcCanvas = sourceCanvasRef.current;
    if (!srcCanvas) return;
    srcCanvas.width = imgW;
    srcCanvas.height = imgH;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return;
    srcCtx.drawImage(img, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, imgW, imgH);

    const outData = ctx.createImageData(outW, outH);

    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const [sx, sy] = applyPerspective(h, x, y);
        const si = Math.round(sx);
        const sj = Math.round(sy);
        const outIdx = (y * outW + x) * 4;
        if (si >= 0 && si < imgW && sj >= 0 && sj < imgH) {
          const srcIdx = (sj * imgW + si) * 4;
          outData.data[outIdx] = srcData.data[srcIdx];
          outData.data[outIdx + 1] = srcData.data[srcIdx + 1];
          outData.data[outIdx + 2] = srcData.data[srcIdx + 2];
          outData.data[outIdx + 3] = 255;
        }
      }
    }
    ctx.putImageData(outData, 0, 0);
  }, [corners]);

  const drawConfig = useCallback(() => {
    const img = imageRef.current;
    const canvas = configCanvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    // Draw polygon
    ctx.beginPath();
    corners.forEach((c, i) => {
      const px = c.x * cw;
      const py = c.y * ch;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw corner handles
    const labels = ['TL', 'TR', 'BR', 'BL'];
    corners.forEach((c, i) => {
      const px = c.x * cw;
      const py = c.y * ch;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = dragging === i ? '#ff0000' : '#00ff00';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], px, py + 3);
    });
  }, [corners, dragging]);

  // Auto-refresh
  useEffect(() => {
    if (configMode) return;
    fetchSnapshot();
    intervalRef.current = setInterval(fetchSnapshot, refreshInterval * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [configMode, refreshInterval, embedUrl, corners]);

  // Redraw when corners change in config mode
  useEffect(() => {
    if (configMode && imageRef.current) {
      drawConfig();
      drawOutput();
    }
  }, [corners, configMode, drawConfig, drawOutput]);

  // Config canvas mouse handling
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    const threshold = 0.04;
    for (let i = 0; i < 4; i++) {
      const dx = pos.x - corners[i].x;
      const dy = pos.y - corners[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        setDragging(i);
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging === null) return;
    const pos = getCanvasPos(e);
    const newCorners = [...corners] as Corners;
    newCorners[dragging] = { x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) };
    setCorners(newCorners);
  };

  const handleMouseUp = () => setDragging(null);

  // Touch handling for mobile
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height,
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getTouchPos(e);
    const threshold = 0.06;
    for (let i = 0; i < 4; i++) {
      const dx = pos.x - corners[i].x;
      const dy = pos.y - corners[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        setDragging(i);
        return;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (dragging === null) return;
    const pos = getTouchPos(e);
    const newCorners = [...corners] as Corners;
    newCorners[dragging] = { x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) };
    setCorners(newCorners);
  };

  const handleTouchEnd = () => setDragging(null);

  // Set output canvas size based on container
  const outputContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const resize = () => {
      const canvas = outputCanvasRef.current;
      const container = outputContainerRef.current;
      if (!canvas || !container) return;
      const w = container.clientWidth;
      const h = Math.min(w * 0.75, window.innerHeight - 120);
      canvas.width = w;
      canvas.height = h;
      if (imageRef.current) drawOutput();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawOutput]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Nevera</h1>
          </div>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button
              variant={configMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (configMode) {
                  // Leaving config mode - fetch fresh snapshot with new corners
                  setConfigMode(false);
                } else {
                  setConfigMode(true);
                  // Fetch snapshot for config view
                  fetchSnapshot();
                }
              }}
              className="gap-2"
            >
              {configMode ? <Eye className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              {configMode ? 'Ver' : 'Configurar'}
            </Button>
          </div>
        </div>

        <canvas ref={sourceCanvasRef} className="hidden" />

        {configMode ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL del stream (embed)</Label>
              <Input
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="https://rtsp.me/embed/..."
              />
            </div>

            <div className="space-y-2">
              <Label>Intervalo de refresco: {refreshInterval}s</Label>
              <Slider
                value={[refreshInterval]}
                onValueChange={([v]) => setRefreshInterval(v)}
                min={3}
                max={60}
                step={1}
              />
            </div>

            <div className="text-sm text-muted-foreground mb-2">
              Arrastra las esquinas verdes para ajustar el recorte de la pizarra:
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Imagen original</p>
                <canvas
                  ref={configCanvasRef}
                  width={640}
                  height={480}
                  className="w-full border rounded-lg cursor-crosshair touch-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Vista corregida</p>
                <div ref={outputContainerRef}>
                  <canvas
                    ref={outputCanvasRef}
                    className="w-full border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveConfig}>Guardar configuración</Button>
              <Button variant="outline" onClick={fetchSnapshot}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar imagen
              </Button>
              <Button variant="outline" onClick={() => setCorners(DEFAULT_CORNERS)}>
                Reiniciar esquinas
              </Button>
            </div>
          </div>
        ) : (
          <div ref={!configMode ? outputContainerRef : undefined}>
            <canvas
              ref={outputCanvasRef}
              className="w-full rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Nevera;

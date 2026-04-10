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
import Hls from "hls.js";

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

function renderCorrectedFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  corners: Corners
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const outW = canvas.width;
  const outH = canvas.height;
  const imgW = video.videoWidth;
  const imgH = video.videoHeight;

  if (!imgW || !imgH) return;

  const srcPx: Corners = corners.map(c => ({ x: c.x * imgW, y: c.y * imgH })) as Corners;
  const dstPx: Corners = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];

  const h = solveProjection(dstPx, srcPx);

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = imgW;
  srcCanvas.height = imgH;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(video, 0, 0);
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
}

function drawConfigOverlayFromVideo(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  corners: Corners,
  dragging: number | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(video, 0, 0, cw, ch);

  ctx.beginPath();
  corners.forEach((c, i) => {
    const px = c.x * cw, py = c.y * ch;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.stroke();

  const labels = ['TL', 'TR', 'BR', 'BL'];
  corners.forEach((c, i) => {
    const px = c.x * cw, py = c.y * ch;
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
}

const Nevera = () => {
  const navigate = useNavigate();
  const { storageMethod } = useStorageMethod();
  const { user } = useAuth();
  const [configMode, setConfigMode] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(DEFAULT_EMBED_URL);
  const [corners, setCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [streamReady, setStreamReady] = useState(false);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const configCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const cornersRef = useRef(corners);
  cornersRef.current = corners;

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

  // Fetch m3u8 URL and start HLS playback
  const startStream = useCallback(async () => {
    setLoading(true);
    setStreamReady(false);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/camera-snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ embedUrl }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (!result.success || !result.m3u8Url) {
        throw new Error(result.error || 'No HLS URL found');
      }

      const video = videoRef.current;
      if (!video) return;

      // Destroy previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 3,
        });
        hls.loadSource(result.m3u8Url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          setStreamReady(true);
          setLoading(false);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            setLoading(false);
            // Try to recover or restart
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              console.log('Attempting HLS recovery...');
              hls.startLoad();
            }
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = result.m3u8Url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {});
          setStreamReady(true);
          setLoading(false);
        }, { once: true });
      }
    } catch (e) {
      console.error('Error starting stream:', e);
      toast.error('Error al conectar con el stream');
      setLoading(false);
    }
  }, [embedUrl]);

  // Start stream on mount
  useEffect(() => {
    startStream();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [startStream]);

  // Capture frames periodically
  useEffect(() => {
    if (!streamReady) return;

    const captureFrame = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      if (!configMode) {
        const main = mainCanvasRef.current;
        const container = mainContainerRef.current;
        if (main && container) {
          const w = container.clientWidth;
          const h = Math.min(w * 0.75, window.innerHeight - 120);
          main.width = w;
          main.height = h;
          renderCorrectedFromVideo(video, main, cornersRef.current);
        }
      } else {
        const configCanvas = configCanvasRef.current;
        if (configCanvas) {
          drawConfigOverlayFromVideo(configCanvas, video, cornersRef.current, null);
        }
        const preview = previewCanvasRef.current;
        if (preview) {
          renderCorrectedFromVideo(video, preview, cornersRef.current);
        }
      }
    };

    // Capture immediately, then at interval
    captureFrame();
    frameIntervalRef.current = setInterval(captureFrame, refreshInterval * 1000);

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, [streamReady, configMode, refreshInterval]);

  // Redraw when corners change in config mode
  useEffect(() => {
    if (!configMode || !streamReady) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const configCanvas = configCanvasRef.current;
    if (configCanvas) drawConfigOverlayFromVideo(configCanvas, video, corners, dragging);
    const preview = previewCanvasRef.current;
    if (preview) renderCorrectedFromVideo(video, preview, corners);
  }, [corners, configMode, dragging, streamReady]);

  // Resize main canvas
  useEffect(() => {
    if (configMode) return;
    const resize = () => {
      const canvas = mainCanvasRef.current;
      const container = mainContainerRef.current;
      if (!canvas || !container) return;
      const w = container.clientWidth;
      const h = Math.min(w * 0.75, window.innerHeight - 120);
      canvas.width = w;
      canvas.height = h;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        renderCorrectedFromVideo(video, canvas, cornersRef.current);
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [configMode]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    for (let i = 0; i < 4; i++) {
      const dx = pos.x - corners[i].x;
      const dy = pos.y - corners[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.04) { setDragging(i); return; }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging === null) return;
    const pos = getCanvasPos(e);
    const nc = [...corners] as Corners;
    nc[dragging] = { x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) };
    setCorners(nc);
  };

  const handleMouseUp = () => setDragging(null);

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    return { x: (t.clientX - rect.left) / rect.width, y: (t.clientY - rect.top) / rect.height };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getTouchPos(e);
    for (let i = 0; i < 4; i++) {
      const dx = pos.x - corners[i].x;
      const dy = pos.y - corners[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.06) { setDragging(i); return; }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (dragging === null) return;
    const pos = getTouchPos(e);
    const nc = [...corners] as Corners;
    nc[dragging] = { x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) };
    setCorners(nc);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hidden video element for HLS playback */}
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="hidden"
          crossOrigin="anonymous"
        />

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
              variant="outline"
              size="sm"
              onClick={startStream}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reconectar
            </Button>
            <Button
              variant={configMode ? "default" : "outline"}
              size="sm"
              onClick={() => setConfigMode(!configMode)}
              className="gap-2"
            >
              {configMode ? <Eye className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              {configMode ? 'Ver' : 'Configurar'}
            </Button>
          </div>
        </div>

        {!streamReady && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No se pudo conectar al stream.</p>
            <Button variant="outline" className="mt-4" onClick={startStream}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        )}

        {configMode ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL del stream (embed)</Label>
              <Input value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} placeholder="https://rtsp.me/embed/..." />
            </div>

            <div className="space-y-2">
              <Label>Intervalo de captura: {refreshInterval}s</Label>
              <Slider value={[refreshInterval]} onValueChange={([v]) => setRefreshInterval(v)} min={1} max={30} step={1} />
            </div>

            <p className="text-sm text-muted-foreground">
              Arrastra las esquinas verdes para ajustar el recorte de la pizarra:
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Imagen original (en vivo)</p>
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
                  onTouchEnd={() => setDragging(null)}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Vista corregida</p>
                <canvas ref={previewCanvasRef} width={640} height={480} className="w-full border rounded-lg" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveConfig}>Guardar configuración</Button>
              <Button variant="outline" onClick={() => setCorners(DEFAULT_CORNERS)}>
                Reiniciar esquinas
              </Button>
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

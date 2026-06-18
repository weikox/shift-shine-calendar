import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, RotateCw, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  name?: string;
  type?: string;
}

export const DocumentViewer = ({
  open,
  onOpenChange,
  src,
  name,
  type,
}: DocumentViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [autoRotated, setAutoRotated] = useState(false);
  const [zoom, setZoom] = useState(1);

  const isImage = type?.startsWith("image/");
  const isPdf = type === "application/pdf";

  const resetState = useCallback(() => {
    setLoading(true);
    setRotation(0);
    setAutoRotated(false);
    setZoom(1);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;

    // If landscape (wider than tall), rotate 90° clockwise
    if (naturalWidth > naturalHeight && !autoRotated) {
      setRotation(90);
      setAutoRotated(true);
    }

    setLoading(false);
  };

  const rotateRight = () => setRotation((r) => (r + 90) % 360);
  const rotateLeft = () => setRotation((r) => (r - 90 + 360) % 360);
  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

  if (!src) return null;

  // For PDFs, open in new tab (rotation doesn't apply)
  if (isPdf) {
    if (open && src) {
      window.open(src, "_blank");
      onOpenChange(false);
    }
    return null;
  }

  // For non-image, non-PDF files, trigger download
  if (!isImage && !isPdf) {
    if (open && src) {
      const link = document.createElement("a");
      link.href = src;
      link.download = name || "document";
      link.click();
      onOpenChange(false);
    }
    return null;
  }

  const isRotated90or270 = rotation === 90 || rotation === 270;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4 flex flex-col gap-2">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground truncate max-w-[50%]">
            {name}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={rotateLeft}
              title="Girar izquierda"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={rotateRight}
              title="Girar derecha"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={zoomOut}
              disabled={zoom <= 0.5}
              title="Reducir"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={zoomIn}
              disabled={zoom >= 3}
              title="Ampliar"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Image container */}
        <div className="flex-1 overflow-auto flex items-center justify-center min-h-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <img
            src={src}
            alt={name || "Documento"}
            onLoad={handleImageLoad}
            className={cn(
              "max-w-full max-h-[80vh] object-contain transition-transform duration-300",
              loading && "opacity-0"
            )}
            style={{
              transform: `rotate(${rotation}deg) scale(${zoom})`,
              // When rotated 90/270, we need to constrain differently
              ...(isRotated90or270
                ? { maxWidth: "80vh", maxHeight: "90vw" }
                : {}),
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

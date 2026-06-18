import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type SedeConfig = {
  location: string;
  fing_url: string | null;
  microcut_seconds: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  knownLocations: string[];
  onSaved?: () => void;
};

export default function SedeConfigDialog({ open, onOpenChange, knownLocations, onSaved }: Props) {
  const [rows, setRows] = useState<SedeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("network_sede_config")
        .select("location, fing_url, microcut_seconds")
        .order("location", { ascending: true });
      if (error) throw error;
      const existing: SedeConfig[] = (data ?? []) as SedeConfig[];
      // Asegurar que toda sede ya vista en network_devices aparece
      const map = new Map(existing.map((r) => [r.location, r]));
      for (const loc of knownLocations) {
        if (!map.has(loc)) {
          map.set(loc, { location: loc, fing_url: "", microcut_seconds: 0 });
        }
      }
      setRows(Array.from(map.values()));
    } catch (e: any) {
      toast.error("Error cargando config: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateRow = (idx: number, patch: Partial<SedeConfig>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((r) => [...r, { location: "", fing_url: "", microcut_seconds: 0 }]);
  };

  const removeRow = async (idx: number) => {
    const row = rows[idx];
    if (row.location) {
      const { error } = await (supabase as any)
        .from("network_sede_config")
        .delete()
        .eq("location", row.location);
      if (error) {
        toast.error("Error borrando: " + error.message);
        return;
      }
    }
    setRows((r) => r.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      const valid = rows.filter((r) => r.location.trim());
      const payload = valid.map((r) => ({
        location: r.location.trim(),
        fing_url: r.fing_url?.trim() || null,
        microcut_seconds: Math.max(0, Number(r.microcut_seconds) || 0),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any)
        .from("network_sede_config")
        .upsert(payload, { onConflict: "location" });
      if (error) throw error;
      toast.success("Configuración guardada");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error guardando: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configuración de sedes (Fing)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sedes. Añade una.</p>
          ) : (
            rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                <div className="col-span-12 md:col-span-3">
                  <Label className="text-xs">Sede</Label>
                  <Input
                    value={row.location}
                    onChange={(e) => updateRow(idx, { location: e.target.value })}
                    placeholder="Casa, Oficina…"
                  />
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Label className="text-xs">URL agente Fing</Label>
                  <Input
                    value={row.fing_url ?? ""}
                    onChange={(e) => updateRow(idx, { fing_url: e.target.value })}
                    placeholder="https://…/devices"
                  />
                </div>
                <div className="col-span-8 md:col-span-2">
                  <Label className="text-xs">Microcortes ≤ (s)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.microcut_seconds}
                    onChange={(e) => updateRow(idx, { microcut_seconds: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-4 md:col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => removeRow(idx)} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Añadir sede
          </Button>

          <p className="text-xs text-muted-foreground">
            El umbral de microcortes oculta de la visualización los cortes cuya duración sea
            menor o igual al valor indicado, uniendo los tramos online adyacentes.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Download, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFinances } from "@/contexts/FinancesContext";

interface Template {
  id: string;
  name: string;
  account_id: string;
  category: "fixed" | "periodic" | "income";
  tx_type: "gasto" | "ingreso";
  estimated_amount: number | null;
  requires_document: boolean;
  sort_order: number;
  is_active: boolean;
}

interface Account {
  id: string;
  name: string;
}

const MonthlyTasksConfig = () => {
  const { user } = useAuth();
  const { currentMonth } = useFinances();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cloudAccounts, setCloudAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({
    name: "",
    account_id: "",
    category: "fixed" as "fixed" | "periodic" | "income",
    estimated_amount: "",
    requires_document: false,
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [tplRes, accRes] = await Promise.all([
      supabase
        .from("monthly_task_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase.from("accounts").select("id,name").eq("user_id", user.id),
    ]);
    if (tplRes.data) setTemplates(tplRes.data as Template[]);
    if (accRes.data) setCloudAccounts(accRes.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      account_id: cloudAccounts[0]?.id || "",
      category: "fixed",
      estimated_amount: "",
      requires_document: false,
    });
    setShowDialog(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({
      name: t.name,
      account_id: t.account_id,
      category: t.category,
      estimated_amount: t.estimated_amount?.toString() || "",
      requires_document: t.requires_document,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim() || !form.account_id) {
      toast.error("Nombre y cuenta son obligatorios");
      return;
    }
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      account_id: form.account_id,
      category: form.category,
      tx_type: form.category === "income" ? "ingreso" : "gasto",
      estimated_amount: form.estimated_amount
        ? parseFloat(form.estimated_amount)
        : null,
      requires_document: form.requires_document,
      sort_order: editing?.sort_order ?? templates.length,
    };

    if (editing) {
      const { error } = await supabase
        .from("monthly_task_templates")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error("Error al guardar");
    } else {
      const { error } = await supabase
        .from("monthly_task_templates")
        .insert(payload);
      if (error) return toast.error("Error al crear");
    }
    toast.success("Guardado");
    setShowDialog(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta tarea recurrente?")) return;
    const { error } = await supabase
      .from("monthly_task_templates")
      .delete()
      .eq("id", id);
    if (error) return toast.error("Error al eliminar");
    toast.success("Eliminada");
    load();
  };

  const handleImportFromPrevMonth = async () => {
    if (!user) return;
    const [year, month] = currentMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const { data: txs, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", prevMonth);
    if (error || !txs) return toast.error("Error cargando mes anterior");

    // Filter: fixed or income only (description starts with [fixed] or [income])
    const candidates = txs.filter((t) => {
      const m = t.description.match(/^\[(\w+)\]/);
      const cat = m?.[1];
      return cat === "fixed" || cat === "income";
    });

    if (candidates.length === 0) {
      toast.info("No hay gastos fijos ni ingresos en el mes anterior");
      return;
    }

    const existingNames = new Set(templates.map((t) => t.name.toLowerCase()));
    const toInsert = candidates
      .map((t, idx) => {
        const m = t.description.match(/^\[(\w+)\]\s*(.*)$/);
        const category = (m?.[1] as "fixed" | "income") || "fixed";
        const name = m?.[2] || t.description;
        return {
          user_id: user.id,
          name,
          account_id: t.account_id,
          category,
          tx_type: category === "income" ? "ingreso" : "gasto",
          estimated_amount: Number(t.amount),
          requires_document: false,
          sort_order: templates.length + idx,
        };
      })
      .filter((p) => !existingNames.has(p.name.toLowerCase()));

    if (toInsert.length === 0) {
      toast.info("Todas las tareas ya existen");
      return;
    }

    const { error: insErr } = await supabase
      .from("monthly_task_templates")
      .insert(toInsert);
    if (insErr) return toast.error("Error al importar");
    toast.success(`${toInsert.length} tareas importadas`);
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= templates.length) return;
    const a = templates[idx];
    const b = templates[newIdx];
    await Promise.all([
      supabase
        .from("monthly_task_templates")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id),
      supabase
        .from("monthly_task_templates")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id),
    ]);
    load();
  };

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-2 mb-4">
          <Link to="/tareas-mes">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl md:text-2xl font-bold flex-1">Configurar tareas</h1>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        </header>

        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Importar desde mes anterior</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={handleImportFromPrevMonth}>
              <Download className="h-4 w-4 mr-2" />
              Copiar gastos fijos e ingresos del mes pasado
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Tareas recurrentes ({templates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin tareas configuradas</p>
            ) : (
              templates.map((t, idx) => {
                const acc = cloudAccounts.find((a) => a.id === t.account_id);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 p-2 border rounded-md"
                  >
                    <div className="flex flex-col">
                      <button
                        onClick={() => move(idx, -1)}
                        className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === 0}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => move(idx, 1)}
                        className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === templates.length - 1}
                      >
                        ▼
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {acc?.name || "?"} · {t.category}
                        {t.estimated_amount && ` · ~${t.estimated_amount}€`}
                        {t.requires_document && " · 📎"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar tarea" : "Nueva tarea recurrente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Hipoteca, Luz, Nómina..."
                />
              </div>
              <div>
                <Label>Cuenta</Label>
                <Select
                  value={form.account_id}
                  onValueChange={(v) => setForm({ ...form, account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cloudAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Select
                  value={form.category}
                  onValueChange={(v: "fixed" | "periodic" | "income") =>
                    setForm({ ...form, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Gasto fijo</SelectItem>
                    <SelectItem value="periodic">Gasto periódico</SelectItem>
                    <SelectItem value="income">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Importe estimado (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.estimated_amount}
                  onChange={(e) =>
                    setForm({ ...form, estimated_amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="req-doc"
                  checked={form.requires_document}
                  onCheckedChange={(c) =>
                    setForm({ ...form, requires_document: !!c })
                  }
                />
                <Label htmlFor="req-doc" className="cursor-pointer">
                  Requiere adjuntar documento
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MonthlyTasksConfig;

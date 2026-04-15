import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, ExternalLink, Pencil, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkItem {
  id: string;
  url: string;
  title: string;
  category: string;
  description: string | null;
  username: string | null;
  password: string | null;
}

const CATEGORIES = [
  "general", "proveedores", "instituciones", "bancos",
  "seguros", "salud", "servicios", "otros",
];

const CATEGORY_LABELS: Record<string, string> = {
  general: "General", proveedores: "Proveedores", instituciones: "Instituciones",
  bancos: "Bancos", seguros: "Seguros", salud: "Salud", servicios: "Servicios", otros: "Otros",
};

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado`);
};

const CredentialChip = ({ label, value, secret }: { label: string; value: string; secret?: boolean }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span className="inline-flex items-center gap-0.5 bg-muted rounded px-1.5 py-0.5 text-[11px] font-mono">
      <span className="text-muted-foreground mr-0.5">{label}:</span>
      <span className="max-w-[80px] truncate">{secret && !visible ? "••••••" : value}</span>
      {secret && (
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVisible(!visible); }} className="ml-0.5 text-muted-foreground hover:text-foreground">
          {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      )}
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(value, label); }} className="ml-0.5 text-muted-foreground hover:text-foreground">
        <Copy className="h-3 w-3" />
      </button>
    </span>
  );
};

const Enlaces = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [form, setForm] = useState({ title: "", url: "", category: "general", description: "", username: "", password: "" });
  const [loading, setLoading] = useState(true);

  const loadLinks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("user_id", user.id)
      .order("category")
      .order("title");
    if (error) toast.error("Error al cargar enlaces");
    else setLinks(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const openNew = () => {
    setEditingLink(null);
    setForm({ title: "", url: "", category: "general", description: "", username: "", password: "" });
    setDialogOpen(true);
  };

  const openEdit = (link: LinkItem) => {
    setEditingLink(link);
    setForm({
      title: link.title, url: link.url, category: link.category,
      description: link.description || "", username: link.username || "", password: link.password || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("Título y URL son obligatorios");
      return;
    }
    let url = form.url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const payload = {
      title: form.title.trim(), url, category: form.category,
      description: form.description.trim() || null,
      username: form.username.trim() || null,
      password: form.password.trim() || null,
    };

    if (editingLink) {
      const { error } = await supabase.from("links").update(payload).eq("id", editingLink.id);
      if (error) toast.error("Error al actualizar");
      else toast.success("Enlace actualizado");
    } else {
      const { error } = await supabase.from("links").insert({ ...payload, user_id: user.id });
      if (error) toast.error("Error al guardar");
      else toast.success("Enlace añadido");
    }
    setDialogOpen(false);
    loadLinks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) toast.error("Error al eliminar");
    else { toast.success("Enlace eliminado"); loadLinks(); }
  };

  const grouped = links.reduce<Record<string, LinkItem[]>>((acc, link) => {
    const cat = link.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {});

  if (!user) {
    return (
      <div className="h-[100dvh] bg-background p-4 flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Inicia sesión para ver tus enlaces</p>
        <Link to="/auth"><Button>Iniciar Sesión</Button></Link>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background p-3 md:p-6 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <h1 className="text-lg md:text-2xl font-bold">Enlaces</h1>
          </div>
          <Button onClick={openNew} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Añadir</Button>
        </div>

        <div className="flex-1 overflow-auto space-y-4">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Cargando...</p>
          ) : links.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay enlaces guardados. Pulsa "Añadir" para crear uno.</p>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <Card key={cat}>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-sm font-semibold">{CATEGORY_LABELS[cat] || cat}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1">
                  {items.map((link) => (
                    <div key={link.id} className="flex items-center gap-2 group rounded-md hover:bg-muted/50 p-1.5">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{link.title}</span>
                          {link.description && (
                            <span className="text-xs text-muted-foreground truncate hidden md:inline">— {link.description}</span>
                          )}
                        </div>
                      </a>
                      {(link.username || link.password) && (
                        <div className="flex items-center gap-1 shrink-0">
                          {link.username && <CredentialChip label="U" value={link.username} />}
                          {link.password && <CredentialChip label="P" value={link.password} secret />}
                        </div>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(link)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(link.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink ? "Editar Enlace" : "Nuevo Enlace"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="URL (ej: www.ejemplo.com)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Descripción (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex gap-2">
              <Input placeholder="Usuario (opcional)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="flex-1" />
              <Input placeholder="Contraseña (opcional)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingLink ? "Guardar" : "Añadir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Enlaces;

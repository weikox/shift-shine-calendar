import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, ExternalLink, Pencil, Trash2, LinkIcon } from "lucide-react";
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
}

const CATEGORIES = [
  "general",
  "proveedores",
  "instituciones",
  "bancos",
  "seguros",
  "salud",
  "servicios",
  "otros",
];

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  proveedores: "Proveedores",
  instituciones: "Instituciones",
  bancos: "Bancos",
  seguros: "Seguros",
  salud: "Salud",
  servicios: "Servicios",
  otros: "Otros",
};

const Enlaces = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [form, setForm] = useState({ title: "", url: "", category: "general", description: "" });
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
    if (error) {
      toast.error("Error al cargar enlaces");
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const openNew = () => {
    setEditingLink(null);
    setForm({ title: "", url: "", category: "general", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (link: LinkItem) => {
    setEditingLink(link);
    setForm({ title: link.title, url: link.url, category: link.category, description: link.description || "" });
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

    if (editingLink) {
      const { error } = await supabase
        .from("links")
        .update({ title: form.title.trim(), url, category: form.category, description: form.description.trim() || null })
        .eq("id", editingLink.id);
      if (error) toast.error("Error al actualizar");
      else toast.success("Enlace actualizado");
    } else {
      const { error } = await supabase
        .from("links")
        .insert({ user_id: user.id, title: form.title.trim(), url, category: form.category, description: form.description.trim() || null });
      if (error) toast.error("Error al guardar");
      else toast.success("Enlace añadido");
    }
    setDialogOpen(false);
    loadLinks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) toast.error("Error al eliminar");
    else {
      toast.success("Enlace eliminado");
      loadLinks();
    }
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
        <Link to="/auth">
          <Button>Iniciar Sesión</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background p-3 md:p-6 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <h1 className="text-lg md:text-2xl font-bold">Enlaces</h1>
          </div>
          <Button onClick={openNew} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Añadir
          </Button>
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
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 flex items-center gap-2"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{link.title}</span>
                        {link.description && (
                          <span className="text-xs text-muted-foreground truncate hidden md:inline">— {link.description}</span>
                        )}
                      </a>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

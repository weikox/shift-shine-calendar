import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Nevera = () => {
  const navigate = useNavigate();
  const { storageMethod, autoSync } = useStorageMethod();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContent();
  }, [storageMethod, user]);

  const loadContent = async () => {
    if (storageMethod === 'local' || !user) {
      const saved = localStorage.getItem('nevera-content');
      if (saved) setContent(saved);
    } else if (storageMethod === 'cloud' || storageMethod === 'hybrid') {
      try {
        const { data, error } = await supabase
          .from('calendar_days')
          .select('note')
          .eq('user_id', user.id)
          .eq('date', 'nevera-note')
          .maybeSingle();

        if (error) throw error;
        if (data) setContent(data.note || '');
      } catch (error) {
        console.error('Error loading nevera:', error);
        const saved = localStorage.getItem('nevera-content');
        if (saved) setContent(saved);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('nevera-content', content);

      if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
        await supabase
          .from('calendar_days')
          .upsert({
            user_id: user.id,
            date: 'nevera-note',
            note: content,
            shift: null,
          });
      }

      toast.success('Nevera guardada');
    } catch (error) {
      console.error('Error saving nevera:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    if (autoSync && (storageMethod === 'cloud' || storageMethod === 'hybrid')) {
      localStorage.setItem('nevera-content', value);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Nevera</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>

        <Textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Lista de compras, recordatorios de la nevera..."
          className="min-h-[calc(100vh-180px)] text-base resize-none font-mono"
        />
      </div>
    </div>
  );
};

export default Nevera;
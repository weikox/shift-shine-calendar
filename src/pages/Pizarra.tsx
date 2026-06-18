import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Pizarra = () => {
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
      const saved = localStorage.getItem('pizarra-content');
      if (saved) setContent(saved);
    } else if (storageMethod === 'cloud' || storageMethod === 'hybrid') {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('content')
          .eq('user_id', user.id)
          .eq('type', 'pizarra')
          .maybeSingle();

        if (error) throw error;
        if (data) setContent(data.content || '');
      } catch (error) {
        console.error('Error loading pizarra:', error);
        const saved = localStorage.getItem('pizarra-content');
        if (saved) setContent(saved);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('pizarra-content', content);

      if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
        await supabase
          .from('notes')
          .upsert({
            user_id: user.id,
            type: 'pizarra',
            content: content,
          }, {
            onConflict: 'user_id,type'
          });
      }

      toast.success('Pizarra guardada');
    } catch (error) {
      console.error('Error saving pizarra:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    if (autoSync && (storageMethod === 'cloud' || storageMethod === 'hybrid')) {
      localStorage.setItem('pizarra-content', value);
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
            <h1 className="text-3xl font-bold text-foreground">Pizarra</h1>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>

        <Textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Escribe tus notas aquí..."
          className="min-h-[calc(100vh-180px)] text-base resize-none font-mono"
        />
      </div>
    </div>
  );
};

export default Pizarra;

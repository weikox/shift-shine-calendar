import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EventsManager } from "@/components/EventsManager";
import { SyncButton } from "@/components/SyncButton";

const ConfigEvents = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/config")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a configuración
          </Button>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-foreground">Gestión de Eventos</h1>
            <div className="pt-1">
              <SyncButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <EventsManager />
      </main>
    </div>
  );
};

export default ConfigEvents;

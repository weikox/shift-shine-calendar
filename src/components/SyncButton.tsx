import { Button } from "@/components/ui/button";
import { Cloud, Loader2 } from "lucide-react";
import { useCalendar } from "@/contexts/CalendarContext";
import { useFinances } from "@/contexts/FinancesContext";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useState } from "react";
import { toast } from "sonner";

export function SyncButton() {
  const { storageMethod, autoSync } = useStorageMethod();
  const { syncToCloud: syncCalendar, lastSync: calendarLastSync } = useCalendar();
  const { syncToCloud: syncFinances, lastSync: financesLastSync } = useFinances();
  const [syncing, setSyncing] = useState(false);

  // Only show if hybrid mode and auto-sync is off, or if in cloud mode
  const shouldShow = (storageMethod === 'hybrid' && !autoSync) || storageMethod === 'cloud';

  if (!shouldShow) return null;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        syncCalendar(),
        syncFinances()
      ]);
    } catch (error) {
      toast.error('Error durante la sincronización');
    } finally {
      setSyncing(false);
    }
  };

  const getLastSyncText = () => {
    const lastSync = calendarLastSync || financesLastSync;
    if (!lastSync) return 'Nunca sincronizado';
    
    const now = new Date();
    const diff = now.getTime() - lastSync.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Sincronizado hace un momento';
    if (minutes === 1) return 'Sincronizado hace 1 minuto';
    if (minutes < 60) return `Sincronizado hace ${minutes} minutos`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Sincronizado hace 1 hora';
    if (hours < 24) return `Sincronizado hace ${hours} horas`;
    
    return `Sincronizado el ${lastSync.toLocaleDateString()}`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Cloud className="h-4 w-4" />
        )}
        {syncing ? 'Sincronizando...' : 'Sincronizar con la Nube'}
      </Button>
      <p className="text-xs text-muted-foreground">
        {getLastSyncText()}
      </p>
    </div>
  );
}
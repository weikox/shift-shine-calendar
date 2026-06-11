import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings } from "lucide-react";
import type { Provider } from "@/lib/weather";

interface Props {
  provider: Provider;
  onProviderChange: (p: Provider) => void;
}

export function WeatherSettingsDialog({ provider, onProviderChange }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configuración">
          <Settings className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label className="text-sm">Proveedor de clima</Label>
          <RadioGroup
            value={provider}
            onValueChange={(v) => onProviderChange(v as Provider)}
            className="space-y-2"
          >
            <label className="flex items-center gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-accent/40">
              <RadioGroupItem value="open-meteo" id="p-om" />
              <div>
                <div className="font-medium text-sm">Open-Meteo</div>
                <div className="text-xs text-muted-foreground">Modelo combinado (predeterminado)</div>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-accent/40">
              <RadioGroupItem value="met-no" id="p-met" />
              <div>
                <div className="font-medium text-sm">MET Norway</div>
                <div className="text-xs text-muted-foreground">Modelo nórdico vía Open-Meteo</div>
              </div>
            </label>
          </RadioGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}

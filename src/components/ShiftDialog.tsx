import { useState, useEffect } from "react";
import { useCalendar, ShiftType } from "@/contexts/CalendarContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftDialogProps {
  selectedDate: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShiftDialog = ({ selectedDate, open, onOpenChange }: ShiftDialogProps) => {
  const { days, setDayShift, config } = useCalendar();
  const [selectedShift, setSelectedShift] = useState<ShiftType>(null);
  const [selectedCompanions, setSelectedCompanions] = useState<string[]>([]);

  const dateStr = selectedDate ? selectedDate.toISOString().split("T")[0] : "";
  const dayData = days[dateStr];

  useEffect(() => {
    if (open && selectedDate) {
      setSelectedShift(dayData?.shift || null);
      setSelectedCompanions(dayData?.companions || []);
    }
  }, [open, selectedDate, dayData]);

  if (!selectedDate) return null;

  const handleShiftSelect = (shift: ShiftType) => {
    setSelectedShift(shift);
  };

  const handleCompanionToggle = (companion: string) => {
    setSelectedCompanions(prev => 
      prev.includes(companion) 
        ? prev.filter(c => c !== companion)
        : [...prev, companion]
    );
  };

  const handleSave = () => {
    setDayShift(dateStr, selectedShift, selectedShift ? selectedCompanions : []);
    onOpenChange(false);
  };

  const handleClear = () => {
    setDayShift(dateStr, null, []);
    onOpenChange(false);
  };

  const shiftOptions = [
    {
      type: "M" as ShiftType,
      label: "M",
      fullLabel: "Mañana",
      icon: Sun,
      color: "bg-shift-morning text-shift-morning-foreground hover:bg-shift-morning/90",
    },
    {
      type: "T" as ShiftType,
      label: "T",
      fullLabel: "Tarde",
      icon: Moon,
      color: "bg-shift-afternoon text-shift-afternoon-foreground hover:bg-shift-afternoon/90",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Seleccionar turno para {selectedDate.toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {/* Shift selection */}
          <div className="flex gap-3">
            {shiftOptions.map(({ type, label, fullLabel, icon: Icon, color }) => (
              <Button
                key={type}
                onClick={() => handleShiftSelect(type)}
                className={cn(
                  "flex-1 h-16 text-lg font-bold transition-all",
                  selectedShift === type && "ring-2 ring-ring ring-offset-2",
                  color
                )}
              >
                <Icon className="mr-2 h-5 w-5" />
                {label}
              </Button>
            ))}
          </div>

          {/* Companions list */}
          {config.companions.length > 0 && selectedShift && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Compañeros</p>
              <div className="grid grid-cols-2 gap-2">
                {config.companions.map((companion) => (
                  <label
                    key={companion}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors",
                      selectedCompanions.includes(companion) 
                        ? "bg-primary/10 border-primary" 
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Checkbox
                      checked={selectedCompanions.includes(companion)}
                      onCheckedChange={() => handleCompanionToggle(companion)}
                    />
                    <span className="text-sm">{companion}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="flex-1">
              Guardar
            </Button>
            {dayData?.shift && (
              <Button variant="outline" onClick={handleClear}>
                Borrar turno
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useCalendar, ShiftType } from "@/contexts/CalendarContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftDialogProps {
  selectedDate: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShiftDialog = ({ selectedDate, open, onOpenChange }: ShiftDialogProps) => {
  const { days, setDayShift } = useCalendar();

  if (!selectedDate) return null;

  const dateStr = selectedDate.toISOString().split("T")[0];
  const currentShift = days[dateStr]?.shift;

  const handleShiftSelect = (shift: ShiftType) => {
    setDayShift(dateStr, shift);
    onOpenChange(false);
  };

  const shiftOptions = [
    {
      type: "M" as ShiftType,
      label: "Mañana",
      icon: Sun,
      color: "bg-shift-morning text-shift-morning-foreground hover:bg-shift-morning/90",
    },
    {
      type: "T" as ShiftType,
      label: "Tarde",
      icon: Moon,
      color: "bg-shift-afternoon text-shift-afternoon-foreground hover:bg-shift-afternoon/90",
    },
    {
      type: "libre" as ShiftType,
      label: "Libre",
      icon: Coffee,
      color: "bg-day-off text-day-off-foreground hover:bg-day-off/90",
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
        
        <div className="grid gap-3 py-4">
          {shiftOptions.map(({ type, label, icon: Icon, color }) => (
            <Button
              key={type}
              onClick={() => handleShiftSelect(type)}
              className={cn(
                "h-16 text-base font-medium transition-all",
                currentShift === type && "ring-2 ring-ring ring-offset-2",
                color
              )}
            >
              <Icon className="mr-2 h-5 w-5" />
              {label}
            </Button>
          ))}
          
          {currentShift && (
            <Button
              variant="outline"
              onClick={() => handleShiftSelect(null)}
              className="mt-2"
            >
              Borrar turno
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

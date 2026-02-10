import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCalendar } from "@/contexts/CalendarContext";
import { Badge } from "@/components/ui/badge";

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export const CalendarHeader = ({ currentDate, onPrevMonth, onNextMonth }: CalendarHeaderProps) => {
  const navigate = useNavigate();
  const { mode, setMode } = useCalendar();

  const monthYear = currentDate.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  return (
    <header className="bg-card border-b border-border px-3 sm:px-6 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Calendario de Turnos</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/config")}
            className="hover:bg-secondary h-8 w-8 sm:h-10 sm:w-10"
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={onPrevMonth}
              className="hover:bg-secondary h-8 w-8 sm:h-10 sm:w-10"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            
            <h2 className="text-base sm:text-xl font-semibold capitalize min-w-[150px] sm:min-w-[200px] text-center">
              {monthYear}
            </h2>
            
            <Button
              variant="outline"
              size="icon"
              onClick={onNextMonth}
              className="hover:bg-secondary h-8 w-8 sm:h-10 sm:w-10"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Badge
              variant={mode === "shifts" ? "default" : "outline"}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
              onClick={() => setMode("shifts")}
            >
              Turnos
            </Badge>
            <Badge
              variant={mode === "events" ? "default" : "outline"}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
              onClick={() => setMode("events")}
            >
              Eventos
            </Badge>
            <Badge
              variant={mode === "history" ? "default" : "outline"}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm"
              onClick={() => setMode("history")}
            >
              Historia
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
};

import { useState } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { ShiftDialog } from "./ShiftDialog";
import { EventDialog } from "./EventDialog";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  currentDate: Date;
}

export const CalendarGrid = ({ currentDate }: CalendarGridProps) => {
  const { mode, days, isHoliday, getEventsForDate } = useCalendar();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get day of week (0 = Sunday, we want Monday = 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;
    
    const daysInMonth = lastDay.getDate();
    const daysArray = [];
    
    // Previous month days
    for (let i = 0; i < startDayOfWeek; i++) {
      daysArray.push(null);
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      daysArray.push(new Date(year, month, i));
    }
    
    return daysArray;
  };

  const getDayData = (date: Date | null) => {
    if (!date) return null;
    const dateStr = date.toISOString().split("T")[0];
    return days[dateStr];
  };

  const isWeekend = (date: Date | null) => {
    if (!date) return false;
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const handleDayClick = (date: Date | null) => {
    if (!date) return;
    setSelectedDate(date);
  };

  const getShiftLabel = (shift: string | null | undefined) => {
    if (!shift) return null;
    if (shift === "M") return "Mañana";
    if (shift === "T") return "Tarde";
    if (shift === "libre") return "Libre";
    return null;
  };

  const getShiftColor = (shift: string | null | undefined) => {
    if (!shift) return "";
    if (shift === "M") return "bg-shift-morning text-shift-morning-foreground";
    if (shift === "T") return "bg-shift-afternoon text-shift-afternoon-foreground";
    if (shift === "libre") return "bg-day-off text-day-off-foreground";
    return "";
  };

  const daysArray = getDaysInMonth(currentDate);
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
          {/* Week days header */}
          <div className="grid grid-cols-7 bg-secondary border-b border-border">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-3 text-center text-sm font-semibold text-secondary-foreground"
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {daysArray.map((date, index) => {
              const dayData = getDayData(date);
              const holiday = date ? isHoliday(date) : undefined;
              const weekend = isWeekend(date);
              const events = date ? getEventsForDate(date) : [];
              
              return (
                <div
                  key={index}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "min-h-[100px] p-2 border-r border-b border-border transition-colors",
                    date && "cursor-pointer hover:bg-secondary/50",
                    !date && "bg-muted",
                    weekend && date && "bg-weekend",
                    holiday && "bg-holiday/10"
                  )}
                >
                  {date && (
                    <div className="h-full flex flex-col">
                      <div className="flex items-start justify-between mb-1">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            holiday || weekend ? "text-holiday" : "text-foreground"
                          )}
                        >
                          {date.getDate()}
                        </span>
                      </div>
                      
                      {/* Show shifts in shifts mode */}
                      {mode === "shifts" && dayData?.shift && (
                        <div
                          className={cn(
                            "mt-auto px-2 py-1 rounded text-xs font-medium text-center",
                            getShiftColor(dayData.shift)
                          )}
                        >
                          {getShiftLabel(dayData.shift)}
                        </div>
                      )}

                      {/* Show events in events mode */}
                      {mode === "events" && events.length > 0 && (
                        <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                          {events.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate"
                            >
                              {event.time && <span className="font-medium">{event.time} </span>}
                              {event.title}
                            </div>
                          ))}
                          {events.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{events.length - 3} más
                            </div>
                          )}
                        </div>
                      )}
                      
                      {holiday && (
                        <div className="mt-1 text-xs text-holiday truncate">
                          {holiday.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {mode === "shifts" ? (
        <ShiftDialog
          selectedDate={selectedDate}
          open={selectedDate !== null}
          onOpenChange={(open) => !open && setSelectedDate(null)}
        />
      ) : (
        <EventDialog
          selectedDate={selectedDate}
          open={selectedDate !== null}
          onOpenChange={(open) => !open && setSelectedDate(null)}
        />
      )}
    </>
  );
};

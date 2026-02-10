import { useState, useMemo } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { useFinances } from "@/contexts/FinancesContext";
import { ShiftDialog } from "./ShiftDialog";
import { EventDialog } from "./EventDialog";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  currentDate: Date;
}

export const CalendarGrid = ({ currentDate }: CalendarGridProps) => {
  const { mode, days, isHoliday, getEventsForDate, config } = useCalendar();
  const { transactions } = useFinances();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Build a map of date -> daily transactions for history mode
  const dailyTransactionsByDate = useMemo(() => {
    const map: Record<string, Array<{ name: string; category: string }>> = {};
    transactions.forEach((t) => {
      if (t.category === "daily" || t.category === "income") {
        const dateStr = t.date.length === 7 ? `${t.date}-01` : t.date;
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({ name: t.name, category: t.category });
      }
    });
    return map;
  }, [transactions]);

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

  const getShiftLabel = (shift: string | null | undefined, isHolidayShift?: boolean) => {
    if (!shift) return null;
    if (isHolidayShift) {
      if (shift === "M") return "MF";
      if (shift === "T") return "TF";
    }
    if (shift === "M") return "M";
    if (shift === "T") return "T";
    return null;
  };

  const getShiftColor = (shift: string | null | undefined, isHolidayShift?: boolean) => {
    if (!shift) return "";
    if (isHolidayShift) {
      if (shift === "M") return "bg-shift-morning text-holiday";
      if (shift === "T") return "bg-shift-afternoon text-holiday";
    }
    if (shift === "M") return "bg-shift-morning text-shift-morning-foreground";
    if (shift === "T") return "bg-shift-afternoon text-shift-afternoon-foreground";
    return "";
  };

  const daysArray = getDaysInMonth(currentDate);
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const getCellHeight = () => {
    switch (config.cellSize) {
      case "small":
        return "min-h-[80px]";
      case "large":
        return "min-h-[140px]";
      default:
        return "min-h-[100px]";
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
          {/* Week days header */}
          <div className="grid grid-cols-7 bg-secondary border-b border-border">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-secondary-foreground"
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
                    getCellHeight(),
                    "p-1.5 sm:p-2 border-r border-b border-border transition-colors",
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
                        <div className="mt-auto">
                          {/* Companions - one per line */}
                          {dayData.companions && dayData.companions.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mb-0.5 space-y-0">
                              {dayData.companions.map((companion, idx) => (
                                <div key={idx} className="truncate leading-tight">
                                  {companion}
                                </div>
                              ))}
                            </div>
                          )}
                          <div
                            className={cn(
                              "px-2 py-1 rounded text-xs font-bold text-center",
                              getShiftColor(dayData.shift, dayData.isHolidayShift)
                            )}
                          >
                            {getShiftLabel(dayData.shift, dayData.isHolidayShift)}
                          </div>
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
                      
                      {/* Show history: events + daily expenses + income */}
                      {mode === "history" && (
                        <div className="mt-1 space-y-0.5 flex-1 overflow-hidden">
                          {events.map((event) => (
                            <div
                              key={event.id}
                              className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate"
                            >
                              {event.title}
                            </div>
                          ))}
                          {(date ? dailyTransactionsByDate[date.toISOString().split("T")[0]] || [] : []).map((t, idx) => (
                            <div
                              key={`tx-${idx}`}
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded truncate",
                                t.category === "income"
                                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                  : "bg-orange-500/10 text-orange-700 dark:text-orange-400"
                              )}
                            >
                              {t.name}
                            </div>
                          ))}
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
      ) : mode === "events" ? (
        <EventDialog
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

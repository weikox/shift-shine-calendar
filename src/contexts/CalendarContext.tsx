import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

export type ShiftType = "M" | "T" | "libre" | null;
export type CalendarMode = "shifts" | "events";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  time?: string;
  date: string; // Original date
  recurrence: RecurrenceType;
  reminderMinutes?: number; // Prerecordatorio en minutos
}

interface DayData {
  shift?: ShiftType;
  note?: string;
  events?: CalendarEvent[];
}

interface Holiday {
  date: string;
  name: string;
}

interface CalendarConfig {
  holidays: Holiday[];
  shiftColors: {
    morning: string;
    afternoon: string;
    dayOff: string;
  };
}

interface CalendarContextType {
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  days: Record<string, DayData>;
  setDayShift: (date: string, shift: ShiftType) => void;
  setDayNote: (date: string, note: string) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (eventId: string, updatedEvent: Partial<CalendarEvent>) => void;
  deleteEvent: (eventId: string) => void;
  getAllEvents: () => CalendarEvent[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  config: CalendarConfig;
  updateConfig: (config: Partial<CalendarConfig>) => void;
  isHoliday: (date: Date) => Holiday | undefined;
  exportData: () => string;
  importData: (jsonData: string) => void;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

const defaultHolidays: Holiday[] = [
  { date: "2025-01-01", name: "Año Nuevo" },
  { date: "2025-01-06", name: "Reyes Magos" },
  { date: "2025-04-18", name: "Viernes Santo" },
  { date: "2025-05-01", name: "Día del Trabajo" },
  { date: "2025-08-15", name: "Asunción" },
  { date: "2025-10-12", name: "Día de la Hispanidad" },
  { date: "2025-11-01", name: "Todos los Santos" },
  { date: "2025-12-06", name: "Día de la Constitución" },
  { date: "2025-12-25", name: "Navidad" },
];

const defaultConfig: CalendarConfig = {
  holidays: defaultHolidays,
  shiftColors: {
    morning: "hsl(var(--shift-morning))",
    afternoon: "hsl(var(--shift-afternoon))",
    dayOff: "hsl(var(--day-off))",
  },
};

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<CalendarMode>("shifts");
  const [days, setDays] = useState<Record<string, DayData>>(() => {
    const saved = localStorage.getItem("calendar-days");
    return saved ? JSON.parse(saved) : {};
  });
  const [config, setConfig] = useState<CalendarConfig>(() => {
    const saved = localStorage.getItem("calendar-config");
    return saved ? JSON.parse(saved) : defaultConfig;
  });

  useEffect(() => {
    localStorage.setItem("calendar-days", JSON.stringify(days));
  }, [days]);

  useEffect(() => {
    localStorage.setItem("calendar-config", JSON.stringify(config));
  }, [config]);

  const setDayShift = (date: string, shift: ShiftType) => {
    setDays((prev) => ({
      ...prev,
      [date]: { ...prev[date], shift },
    }));
  };

  const setDayNote = (date: string, note: string) => {
    setDays((prev) => ({
      ...prev,
      [date]: { ...prev[date], note },
    }));
  };

  const updateConfig = (newConfig: Partial<CalendarConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const isHoliday = (date: Date): Holiday | undefined => {
    const dateStr = date.toISOString().split("T")[0];
    return config.holidays.find((h) => h.date === dateStr);
  };

  const addEvent = (event: CalendarEvent) => {
    const dateStr = event.date;
    setDays((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        events: [...(prev[dateStr]?.events || []), event],
      },
    }));
  };

  const updateEvent = (eventId: string, updatedEvent: Partial<CalendarEvent>) => {
    setDays((prev) => {
      const newDays = { ...prev };
      Object.keys(newDays).forEach((dateStr) => {
        if (newDays[dateStr].events) {
          newDays[dateStr].events = newDays[dateStr].events!.map((e) =>
            e.id === eventId ? { ...e, ...updatedEvent } : e
          );
        }
      });
      return newDays;
    });
  };

  const deleteEvent = (eventId: string) => {
    setDays((prev) => {
      const newDays = { ...prev };
      Object.keys(newDays).forEach((dateStr) => {
        if (newDays[dateStr].events) {
          newDays[dateStr].events = newDays[dateStr].events!.filter(
            (e) => e.id !== eventId
          );
        }
      });
      return newDays;
    });
  };

  const getAllEvents = (): CalendarEvent[] => {
    const allEvents: CalendarEvent[] = [];
    Object.values(days).forEach((dayData) => {
      if (dayData.events) {
        allEvents.push(...dayData.events);
      }
    });
    return allEvents;
  };

  const exportData = (): string => {
    return JSON.stringify({ days, config }, null, 2);
  };

  const importData = (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.days) setDays(data.days);
      if (data.config) setConfig(data.config);
      toast.success("Datos importados correctamente");
    } catch (error) {
      toast.error("Error al importar datos. Verifica el formato del archivo.");
    }
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split("T")[0];
    const allEvents: CalendarEvent[] = [];

    // Get events from all days
    Object.values(days).forEach((dayData) => {
      dayData.events?.forEach((event) => {
        if (eventMatchesDate(event, date)) {
          allEvents.push(event);
        }
      });
    });

    return allEvents;
  };

  const eventMatchesDate = (event: CalendarEvent, targetDate: Date): boolean => {
    const eventDate = new Date(event.date);
    const targetDateStr = targetDate.toISOString().split("T")[0];
    const eventDateStr = eventDate.toISOString().split("T")[0];

    if (eventDateStr === targetDateStr) return true;

    if (event.recurrence === "none") return false;

    // Check if target date is after event date
    if (targetDate < eventDate) return false;

    switch (event.recurrence) {
      case "daily":
        return true;
      case "weekly":
        return eventDate.getDay() === targetDate.getDay();
      case "monthly":
        return eventDate.getDate() === targetDate.getDate();
      case "yearly":
        return (
          eventDate.getDate() === targetDate.getDate() &&
          eventDate.getMonth() === targetDate.getMonth()
        );
      default:
        return false;
    }
  };

  return (
    <CalendarContext.Provider
      value={{
        mode,
        setMode,
        days,
        setDayShift,
        setDayNote,
        addEvent,
        updateEvent,
        deleteEvent,
        getAllEvents,
        getEventsForDate,
        config,
        updateConfig,
        isHoliday,
        exportData,
        importData,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }
  return context;
};

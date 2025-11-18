import React, { createContext, useContext, useState, useEffect } from "react";

export type ShiftType = "M" | "T" | "libre" | null;
export type CalendarMode = "shifts" | "events";

interface DayData {
  shift?: ShiftType;
  note?: string;
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
  config: CalendarConfig;
  updateConfig: (config: Partial<CalendarConfig>) => void;
  isHoliday: (date: Date) => Holiday | undefined;
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

  return (
    <CalendarContext.Provider
      value={{
        mode,
        setMode,
        days,
        setDayShift,
        setDayNote,
        config,
        updateConfig,
        isHoliday,
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

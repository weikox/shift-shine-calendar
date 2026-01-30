import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStorageMethod } from "@/hooks/useStorageMethod";
import { useAuth } from "@/hooks/useAuth";

export type ShiftType = "M" | "T" | null;
export type CalendarMode = "shifts" | "events";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  time?: string;
  date: string;
  recurrence: RecurrenceType;
  reminderMinutes?: number;
}

interface DayData {
  shift?: ShiftType;
  companions?: string[];
  note?: string;
  events?: CalendarEvent[];
}

interface Holiday {
  date: string;
  name: string;
}

interface CalendarConfig {
  holidays: Holiday[];
  companions: string[];
  shiftColors: {
    morning: string;
    afternoon: string;
    dayOff: string;
  };
  cellSize: "small" | "medium" | "large";
}

interface CalendarContextType {
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  days: Record<string, DayData>;
  setDayShift: (date: string, shift: ShiftType, companions?: string[]) => void;
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
  syncToCloud: () => Promise<void>;
  lastSync: Date | null;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

// Holiday dates in MM-DD format for annual recurrence
const defaultHolidays: Holiday[] = [
  { date: "01-01", name: "Año Nuevo" },
  { date: "01-06", name: "Reyes Magos" },
  { date: "05-01", name: "Día del Trabajo" },
  { date: "08-15", name: "Asunción" },
  { date: "10-12", name: "Día de la Hispanidad" },
  { date: "11-01", name: "Todos los Santos" },
  { date: "12-06", name: "Día de la Constitución" },
  { date: "12-25", name: "Navidad" },
];

const defaultConfig: CalendarConfig = {
  holidays: defaultHolidays,
  companions: [],
  shiftColors: {
    morning: "hsl(var(--shift-morning))",
    afternoon: "hsl(var(--shift-afternoon))",
    dayOff: "hsl(var(--day-off))",
  },
  cellSize: "medium",
};

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { storageMethod, autoSync } = useStorageMethod();
  const { user } = useAuth();
  const [mode, setMode] = useState<CalendarMode>("shifts");
  const [days, setDays] = useState<Record<string, DayData>>({});
  const [config, setConfig] = useState<CalendarConfig>(defaultConfig);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingSync, setPendingSync] = useState(false);

  // Refs to always have access to the latest values in async operations
  const daysRef = useRef(days);
  const configRef = useRef(config);

  // Keep refs in sync with state
  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [storageMethod, user]);

  const loadInitialData = async () => {
    if (storageMethod === 'local' || !user) {
      // Load from localStorage
      const savedDays = localStorage.getItem("calendar-days");
      const savedConfig = localStorage.getItem("calendar-config");
      setDays(savedDays ? JSON.parse(savedDays) : {});
      setConfig(savedConfig ? JSON.parse(savedConfig) : defaultConfig);
    } else if (storageMethod === 'cloud') {
      // Load only from cloud
      await loadFromCloud();
    } else if (storageMethod === 'hybrid') {
      // Load from cloud and merge with local
      const savedDays = localStorage.getItem("calendar-days");
      const savedConfig = localStorage.getItem("calendar-config");
      const localDays = savedDays ? JSON.parse(savedDays) : {};
      const localConfig = savedConfig ? JSON.parse(savedConfig) : defaultConfig;
      
      await loadFromCloud();
      
      // Merge: prioritize cloud data
      setDays(prev => ({ ...localDays, ...prev }));
      setConfig(prev => ({ ...localConfig, ...prev }));
    }
  };

  const loadFromCloud = async () => {
    if (!user) return;

    try {
      // Load days with shifts and notes
      const { data: calendarDays, error: daysError } = await supabase
        .from('calendar_days')
        .select('*')
        .eq('user_id', user.id);

      if (daysError) throw daysError;

      // Load events
      const { data: calendarEvents, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id);

      if (eventsError) throw eventsError;

      // Load config
      const { data: calendarConfig, error: configError } = await supabase
        .from('calendar_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (configError) throw configError;

      // Build days object
      const daysMap: Record<string, DayData> = {};
      
      calendarDays?.forEach(day => {
        daysMap[day.date] = {
          shift: day.shift as ShiftType,
          companions: (day as any).companions || [],
          note: day.note || undefined,
          events: []
        };
      });

      // Add events to their dates
      calendarEvents?.forEach(event => {
        const eventData: CalendarEvent = {
          id: event.id,
          title: event.title,
          description: event.description || undefined,
          date: event.start_date,
          recurrence: (event.recurrence || 'none') as RecurrenceType,
        };

        if (!daysMap[event.start_date]) {
          daysMap[event.start_date] = { events: [] };
        }
        if (!daysMap[event.start_date].events) {
          daysMap[event.start_date].events = [];
        }
        daysMap[event.start_date].events!.push(eventData);
      });

      setDays(daysMap);

      if (calendarConfig) {
        setConfig({
          holidays: (calendarConfig.holidays as any) || defaultHolidays,
          companions: (calendarConfig as any).companions || [],
          shiftColors: defaultConfig.shiftColors,
          cellSize: (calendarConfig.cell_size as any) || 'medium'
        });
      }

      setLastSync(new Date());
    } catch (error) {
      console.error('Error loading from cloud:', error);
      toast.error('Error al cargar datos de la nube');
    }
  };

  const isNetworkError = (error: unknown): boolean => {
    if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
      return true;
    }
    return false;
  };

  const normalizeNote = (note?: string | null) => (note ?? "").trim();

  const hasDayCloudData = (data: DayData) => {
    const hasShift = data.shift === "M" || data.shift === "T";
    const hasNote = normalizeNote(data.note).length > 0;
    const hasCompanions = (data.companions?.length ?? 0) > 0;
    return hasShift || hasNote || hasCompanions;
  };

  const syncToCloud = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para sincronizar');
      return;
    }

    setPendingSync(true);
    try {
      // Use refs to get the most current values
      const currentDays = daysRef.current;
      const currentConfig = configRef.current;

      // Sync days (shifts/notes/companions) + deletions
      // IMPORTANT: if a user clears a shift/note/companions locally, we must delete it in cloud,
      // otherwise it will reappear after refresh.
      const { data: cloudDays, error: cloudDaysError } = await supabase
        .from('calendar_days')
        .select('date')
        .eq('user_id', user.id);

      if (cloudDaysError) throw cloudDaysError;

      const cloudDates = new Set((cloudDays ?? []).map((d: any) => d.date as string));

      const clearedDatesInCloud = Object.entries(currentDays)
        .filter(([date, data]) => !!data && cloudDates.has(date) && !hasDayCloudData(data))
        .map(([date]) => date);

      if (clearedDatesInCloud.length > 0) {
        const { error: deleteClearedDaysError } = await supabase
          .from('calendar_days')
          .delete()
          .eq('user_id', user.id)
          .in('date', clearedDatesInCloud);

        if (deleteClearedDaysError) throw deleteClearedDaysError;
      }

      const daysPayload = Object.entries(currentDays)
        .filter(([_, data]) => !!data && hasDayCloudData(data))
        .map(([date, data]) => ({
          user_id: user.id,
          date,
          shift: data.shift ?? null,
          note: normalizeNote(data.note) || null,
          companions: data.companions || [],
        }));

      if (daysPayload.length > 0) {
        const { error: upsertDaysError } = await supabase
          .from('calendar_days')
          .upsert(daysPayload as any, {
            // En BD existe UNIQUE(user_id, date)
            onConflict: 'user_id,date',
          });

        if (upsertDaysError) throw upsertDaysError;
      }

      // Sync events
      const allEvents = collectAllEventsFromDays(currentDays);
      for (const event of allEvents) {
        const { error: upsertEventError } = await supabase
          .from('calendar_events')
          .upsert({
            id: event.id,
            user_id: user.id,
            title: event.title,
            description: event.description || null,
            start_date: event.date,
            end_date: event.date,
            recurrence: event.recurrence || null,
          }, {
            onConflict: 'id',
          });

        if (upsertEventError) throw upsertEventError;
      }

      // Sync config using ref for current values
      const { error: upsertConfigError } = await supabase
        .from('calendar_config')
        .upsert({
          user_id: user.id,
          holidays: currentConfig.holidays as any,
          cell_size: currentConfig.cellSize,
          companions: currentConfig.companions,
        } as any, {
          // En BD existe UNIQUE(user_id)
          onConflict: 'user_id',
        });

      if (upsertConfigError) throw upsertConfigError;

      setLastSync(new Date());
      toast.success('Datos sincronizados con la nube');
    } catch (error) {
      console.error('Error syncing to cloud:', error);
      if (isNetworkError(error)) {
        toast.error('Error de conexión. Los datos se guardarán localmente.');
      } else {
        toast.error('Error al sincronizar con la nube');
      }
    } finally {
      setPendingSync(false);
    }
  };

  function collectAllEventsFromDays(daysObj: Record<string, DayData>): CalendarEvent[] {
    const allEvents: CalendarEvent[] = [];
    Object.values(daysObj).forEach((dayData) => {
      if (dayData.events) {
        allEvents.push(...dayData.events);
      }
    });
    return allEvents;
  }

  const saveToStorage = (newDays: Record<string, DayData>, newConfig?: CalendarConfig) => {
    // Always save to localStorage for instant feedback
    if (storageMethod !== 'cloud') {
      localStorage.setItem("calendar-days", JSON.stringify(newDays));
      if (newConfig) {
        localStorage.setItem("calendar-config", JSON.stringify(newConfig));
      }
    }

    // Sync to cloud if needed
    if ((storageMethod === 'cloud' || storageMethod === 'hybrid') && user) {
      if (autoSync && !pendingSync) {
        setTimeout(() => syncToCloud(), 2000);
      }
    }
  };

  useEffect(() => {
    if (storageMethod !== 'cloud') {
      localStorage.setItem("calendar-days", JSON.stringify(days));
    }
  }, [days, storageMethod]);

  useEffect(() => {
    if (storageMethod !== 'cloud') {
      localStorage.setItem("calendar-config", JSON.stringify(config));
    }
  }, [config, storageMethod]);

  const setDayShift = (date: string, shift: ShiftType, companions?: string[]) => {
    const newDays = {
      ...days,
      [date]: { ...days[date], shift, companions: companions || [] },
    };
    setDays(newDays);
    // Update ref immediately so syncToCloud has the latest value
    daysRef.current = newDays;
    saveToStorage(newDays);
  };

  const setDayNote = (date: string, note: string) => {
    const newDays = {
      ...days,
      [date]: { ...days[date], note },
    };
    setDays(newDays);
    // Update ref immediately so syncToCloud has the latest value
    daysRef.current = newDays;
    saveToStorage(newDays);
  };

  const updateConfig = (newConfig: Partial<CalendarConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    // Update ref immediately so syncToCloud has the latest value
    configRef.current = updatedConfig;
    saveToStorage(days, updatedConfig);
  };

  const isHoliday = (date: Date): Holiday | undefined => {
    // Extract month-day from the date for annual comparison
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const monthDay = `${month}-${day}`;
    
    return config.holidays.find((h) => {
      // Support both MM-DD and legacy YYYY-MM-DD formats
      const holidayMonthDay = h.date.length === 5 ? h.date : h.date.slice(5);
      return holidayMonthDay === monthDay;
    });
  };

  const addEvent = (event: CalendarEvent) => {
    const dateStr = event.date;
    const newDays = {
      ...days,
      [dateStr]: {
        ...days[dateStr],
        events: [...(days[dateStr]?.events || []), event],
      },
    };
    setDays(newDays);
    // Update ref immediately so syncToCloud has the latest value
    daysRef.current = newDays;
    saveToStorage(newDays);
  };

  const updateEvent = (eventId: string, updatedEvent: Partial<CalendarEvent>) => {
    const newDays = { ...days };
    Object.keys(newDays).forEach((dateStr) => {
      if (newDays[dateStr].events) {
        newDays[dateStr].events = newDays[dateStr].events!.map((e) =>
          e.id === eventId ? { ...e, ...updatedEvent } : e
        );
      }
    });
    setDays(newDays);
    // Update ref immediately so syncToCloud has the latest value
    daysRef.current = newDays;
    saveToStorage(newDays);
  };

  const deleteEvent = (eventId: string) => {
    const newDays = { ...days };
    Object.keys(newDays).forEach((dateStr) => {
      if (newDays[dateStr].events) {
        newDays[dateStr].events = newDays[dateStr].events!.filter(
          (e) => e.id !== eventId
        );
      }
    });
    setDays(newDays);
    // Update ref immediately so syncToCloud has the latest value
    daysRef.current = newDays;
    saveToStorage(newDays);
  };

  const getAllEvents = (): CalendarEvent[] => {
    return collectAllEventsFromDays(days);
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
    const allEvents: CalendarEvent[] = [];

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
        syncToCloud,
        lastSync,
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
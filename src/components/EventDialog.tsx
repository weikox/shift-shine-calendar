import { useState } from "react";
import { useCalendar, CalendarEvent, RecurrenceType } from "@/contexts/CalendarContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calendar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EventDialogProps {
  selectedDate: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventDialog = ({ selectedDate, open, onOpenChange }: EventDialogProps) => {
  const { getEventsForDate, addEvent, updateEvent, deleteEvent } = useCalendar();
  const [isAdding, setIsAdding] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);

  if (!selectedDate) return null;

  const events = getEventsForDate(selectedDate);
  const dateStr = selectedDate.toISOString().split("T")[0];

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTime("");
    setRecurrence("none");
    setReminderMinutes(0);
    setIsAdding(false);
    setEditingEventId(null);
  };

  const handleSaveEvent = () => {
    if (!title.trim()) return;

    if (editingEventId) {
      // Update existing event
      updateEvent(editingEventId, {
        title: title.trim(),
        description: description.trim(),
        time: time || undefined,
        recurrence,
        reminderMinutes: reminderMinutes > 0 ? reminderMinutes : undefined,
      });
    } else {
      // Add new event
      const newEvent: CalendarEvent = {
        // IMPORTANT: backend expects UUID (column type uuid). Non-UUID ids will fail to persist.
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        time: time || undefined,
        date: dateStr,
        recurrence,
        reminderMinutes: reminderMinutes > 0 ? reminderMinutes : undefined,
      };
      addEvent(newEvent);
    }
    
    resetForm();
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setTitle(event.title);
    setDescription(event.description || "");
    setTime(event.time || "");
    setRecurrence(event.recurrence);
    setReminderMinutes(event.reminderMinutes || 0);
    setIsAdding(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent(eventId);
  };

  const recurrenceLabels: Record<RecurrenceType, string> = {
    none: "Sin repetir",
    daily: "Diario",
    weekly: "Semanal",
    monthly: "Mensual",
    yearly: "Anual",
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        resetForm();
      }
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Eventos - {selectedDate.toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Existing events */}
            {events.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Eventos del día</h3>
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{event.title}</h4>
                          {event.time && (
                            <span className="text-xs text-muted-foreground">{event.time}</span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                        {event.recurrence !== "none" && (
                          <p className="text-xs text-primary mt-1">
                            🔄 {recurrenceLabels[event.recurrence]}
                          </p>
                        )}
                      </div>
                       <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditEvent(event)}
                        >
                          <span className="text-sm">✏️</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit event form */}
            {isAdding ? (
              <div className="space-y-4 p-4 rounded-lg border border-border bg-secondary/30">
                <h3 className="font-medium text-sm">
                  {editingEventId ? "Editar evento" : "Añadir evento"}
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Ej: Reunión equipo"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Hora (opcional)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Detalles adicionales..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrence">Repetición</Label>
                  <Select value={recurrence} onValueChange={(value) => setRecurrence(value as RecurrenceType)}>
                    <SelectTrigger id="recurrence">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin repetir</SelectItem>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminder">Prerecordatorio</Label>
                  <Select 
                    value={reminderMinutes.toString()} 
                    onValueChange={(value) => setReminderMinutes(parseInt(value))}
                  >
                    <SelectTrigger id="reminder">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sin recordatorio</SelectItem>
                      <SelectItem value="5">5 minutos antes</SelectItem>
                      <SelectItem value="15">15 minutos antes</SelectItem>
                      <SelectItem value="30">30 minutos antes</SelectItem>
                      <SelectItem value="60">1 hora antes</SelectItem>
                      <SelectItem value="1440">1 día antes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveEvent}
                    disabled={!title.trim()}
                    className="flex-1"
                  >
                    {editingEventId ? "Actualizar evento" : "Guardar evento"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetForm}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setIsAdding(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Añadir evento
              </Button>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

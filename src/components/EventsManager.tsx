import { useState } from "react";
import { useCalendar, CalendarEvent, RecurrenceType } from "@/contexts/CalendarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import { toast } from "sonner";

export const EventsManager = () => {
  const { getAllEvents, addEvent, updateEvent, deleteEvent } = useCalendar();
  const [isAdding, setIsAdding] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);

  const allEvents = getAllEvents();
  const recurringEvents = allEvents.filter((e) => e.recurrence !== "none");
  const oneTimeEvents = allEvents.filter((e) => e.recurrence === "none");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTime("");
    setDate("");
    setRecurrence("none");
    setReminderMinutes(0);
    setIsAdding(false);
    setEditingEventId(null);
  };

  const handleSaveEvent = () => {
    if (!title.trim() || !date) {
      toast.error("El título y la fecha son obligatorios");
      return;
    }

    if (editingEventId) {
      updateEvent(editingEventId, {
        title: title.trim(),
        description: description.trim(),
        time: time || undefined,
        date,
        recurrence,
        reminderMinutes: reminderMinutes > 0 ? reminderMinutes : undefined,
      });
      toast.success("Evento actualizado");
    } else {
      const newEvent: CalendarEvent = {
        // IMPORTANT: backend expects UUID (column type uuid). Non-UUID ids will fail to persist.
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        time: time || undefined,
        date,
        recurrence,
        reminderMinutes: reminderMinutes > 0 ? reminderMinutes : undefined,
      };
      addEvent(newEvent);
      toast.success("Evento añadido");
    }

    resetForm();
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setTitle(event.title);
    setDescription(event.description || "");
    setTime(event.time || "");
    setDate(event.date);
    setRecurrence(event.recurrence);
    setReminderMinutes(event.reminderMinutes || 0);
    setIsAdding(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent(eventId);
    toast.success("Evento eliminado");
  };

  const recurrenceLabels: Record<RecurrenceType, string> = {
    none: "Sin repetir",
    daily: "Diario",
    weekly: "Semanal",
    monthly: "Mensual",
    yearly: "Anual",
  };

  const EventsList = ({ events }: { events: CalendarEvent[] }) => (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No hay eventos
        </p>
      ) : (
        events
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((event) => (
            <div
              key={event.id}
              className="p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-foreground">{event.title}</h4>
                    {event.time && (
                      <span className="text-xs text-muted-foreground">{event.time}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.date + "T00:00:00").toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                  {event.recurrence !== "none" && (
                    <p className="text-xs text-primary mt-1">
                      🔄 {recurrenceLabels[event.recurrence]}
                    </p>
                  )}
                  {event.reminderMinutes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      🔔 Recordatorio: {event.reminderMinutes >= 1440 
                        ? `${event.reminderMinutes / 1440} día(s) antes`
                        : event.reminderMinutes >= 60
                        ? `${event.reminderMinutes / 60} hora(s) antes`
                        : `${event.reminderMinutes} minuto(s) antes`}
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
                    <Edit2 className="h-4 w-4" />
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
          ))
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Eventos</CardTitle>
        <CardDescription>
          Crea, edita y elimina eventos del calendario
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add/Edit event form */}
        {isAdding ? (
          <div className="space-y-4 p-4 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">
                {editingEventId ? "Editar evento" : "Añadir evento"}
              </h3>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-title">Título *</Label>
              <Input
                id="event-title"
                placeholder="Ej: Reunión equipo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Fecha *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-time">Hora (opcional)</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Descripción (opcional)</Label>
              <Textarea
                id="event-description"
                placeholder="Detalles adicionales..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-recurrence">Repetición</Label>
                <Select value={recurrence} onValueChange={(value) => setRecurrence(value as RecurrenceType)}>
                  <SelectTrigger id="event-recurrence">
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
                <Label htmlFor="event-reminder">Prerecordatorio</Label>
                <Select 
                  value={reminderMinutes.toString()} 
                  onValueChange={(value) => setReminderMinutes(parseInt(value))}
                >
                  <SelectTrigger id="event-reminder">
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
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveEvent}
                disabled={!title.trim() || !date}
                className="flex-1"
              >
                {editingEventId ? "Actualizar evento" : "Guardar evento"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setIsAdding(true)} className="w-full" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Añadir evento
          </Button>
        )}

        {/* Events tabs */}
        <Tabs defaultValue="recurring" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recurring">
              Repetibles ({recurringEvents.length})
            </TabsTrigger>
            <TabsTrigger value="onetime">
              Puntuales ({oneTimeEvents.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recurring" className="space-y-4">
            <EventsList events={recurringEvents} />
          </TabsContent>
          <TabsContent value="onetime" className="space-y-4">
            <EventsList events={oneTimeEvents} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

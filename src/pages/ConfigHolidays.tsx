import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendar } from "@/contexts/CalendarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { toast } from "sonner";

const ConfigHolidays = () => {
  const navigate = useNavigate();
  const { config, updateConfig } = useCalendar();
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");

  // Convert date to MM-DD format for annual recurrence
  const formatToMonthDay = (dateStr: string): string => {
    // If already in MM-DD format, return as is
    if (/^\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // Extract month-day from YYYY-MM-DD
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[1]}-${parts[2]}`;
    }
    return dateStr;
  };

  // Get display date for input (needs YYYY-MM-DD for input type="date")
  const getInputDate = (monthDay: string): string => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${monthDay}`;
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const monthDay = formatToMonthDay(newHolidayDate);
    
    // Check for duplicates
    if (config.holidays.some(h => formatToMonthDay(h.date) === monthDay)) {
      toast.error("Ya existe un festivo en esta fecha");
      return;
    }

    const updatedHolidays = [
      ...config.holidays,
      { date: monthDay, name: newHolidayName.trim() },
    ].sort((a, b) => formatToMonthDay(a.date).localeCompare(formatToMonthDay(b.date)));

    updateConfig({ holidays: updatedHolidays });
    setNewHolidayDate("");
    setNewHolidayName("");
    toast.success("Festivo añadido correctamente");
  };

  const handleRemoveHoliday = (dateToRemove: string) => {
    const updatedHolidays = config.holidays.filter((h) => h.date !== dateToRemove);
    updateConfig({ holidays: updatedHolidays });
    toast.success("Festivo eliminado");
  };

  const handleStartEdit = (holiday: { date: string; name: string }) => {
    setEditingId(holiday.date);
    setEditName(holiday.name);
    setEditDate(formatToMonthDay(holiday.date));
  };

  const handleSaveEdit = (originalDate: string) => {
    if (!editDate || !editName.trim()) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const newMonthDay = formatToMonthDay(editDate);
    
    // Check for duplicates (excluding current holiday)
    if (config.holidays.some(h => formatToMonthDay(h.date) === newMonthDay && h.date !== originalDate)) {
      toast.error("Ya existe un festivo en esta fecha");
      return;
    }

    const updatedHolidays = config.holidays.map(h => 
      h.date === originalDate 
        ? { date: newMonthDay, name: editName.trim() }
        : h
    ).sort((a, b) => formatToMonthDay(a.date).localeCompare(formatToMonthDay(b.date)));

    updateConfig({ holidays: updatedHolidays });
    setEditingId(null);
    toast.success("Festivo actualizado");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDate("");
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string): string => {
    const monthDay = formatToMonthDay(dateStr);
    const [month, day] = monthDay.split("-");
    const date = new Date(2000, parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/config")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a configuración
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Festivos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Los festivos se repiten automáticamente cada año
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Festivos</CardTitle>
            <CardDescription>
              Gestiona los días festivos que se mostrarán en el calendario. Se repiten anualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add new holiday */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="holiday-date">Fecha</Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holiday-name">Nombre</Label>
                  <Input
                    id="holiday-name"
                    placeholder="Ej: Día de Reyes"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddHoliday()}
                  />
                </div>
              </div>
              <Button onClick={handleAddHoliday} className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Añadir festivo
              </Button>
            </div>

            {/* List of holidays */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                Festivos configurados ({config.holidays.length})
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {config.holidays.map((holiday) => (
                  <div
                    key={holiday.date}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    {editingId === holiday.date ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          type="date"
                          value={getInputDate(editDate)}
                          onChange={(e) => setEditDate(formatToMonthDay(e.target.value))}
                          className="w-40"
                        />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(holiday.date)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSaveEdit(holiday.date)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-100"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-medium text-foreground">{holiday.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDisplayDate(holiday.date)} (cada año)
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(holiday)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveHoliday(holiday.date)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ConfigHolidays;

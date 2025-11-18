import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCalendar } from "@/contexts/CalendarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const Config = () => {
  const navigate = useNavigate();
  const { config, updateConfig } = useCalendar();
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    const updatedHolidays = [
      ...config.holidays,
      { date: newHolidayDate, name: newHolidayName },
    ].sort((a, b) => a.date.localeCompare(b.date));

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

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al calendario
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Festivos</CardTitle>
            <CardDescription>
              Gestiona los días festivos que se mostrarán en el calendario
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
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {config.holidays.map((holiday) => (
                  <div
                    key={holiday.date}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(holiday.date + "T00:00:00").toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveHoliday(holiday.date)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Leyenda de turnos</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-shift-morning rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-shift-morning-foreground">M</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Turno de Mañana</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-shift-afternoon rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-shift-afternoon-foreground">T</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Turno de Tarde</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-day-off rounded flex items-center justify-center">
                    <span className="text-xs font-medium text-day-off-foreground">L</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Día Libre</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Config;

import { Link } from "react-router-dom";
import { Calendar, Wallet, StickyNote, Refrigerator, Home } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCalendar } from "@/contexts/CalendarContext";
import { useFinances } from "@/contexts/FinancesContext";
import { useMemo } from "react";

const Index = () => {
  const { days } = useCalendar();
  const { getTotalBalance, getPendingTransactionsTotal } = useFinances();

  const calendarSummary = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayShift = days[todayStr]?.shift;

    // Find next day with shift
    let nextShiftDay = null;
    let nextShiftDate = new Date(today);
    nextShiftDate.setDate(nextShiftDate.getDate() + 1);
    
    for (let i = 0; i < 365; i++) {
      const dateStr = nextShiftDate.toISOString().split('T')[0];
      if (days[dateStr]?.shift && days[dateStr]?.shift !== 'libre') {
        nextShiftDay = {
          shift: days[dateStr].shift,
          date: nextShiftDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        };
        break;
      }
      nextShiftDate.setDate(nextShiftDate.getDate() + 1);
    }

    return { todayShift, nextShiftDay };
  }, [days]);

  const financesSummary = useMemo(() => {
    const currentBalance = getTotalBalance();
    const pendingTotal = getPendingTransactionsTotal();
    const projectedBalance = currentBalance + pendingTotal;

    return { currentBalance, pendingTotal, projectedBalance };
  }, [getTotalBalance, getPendingTransactionsTotal]);

  const getShiftLabel = (shift: string | null) => {
    if (!shift) return "Sin turno";
    if (shift === "M") return "Mañana";
    if (shift === "T") return "Tarde";
    if (shift === "libre") return "Libre";
    return shift;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Panel de Control</h1>
          <p className="text-muted-foreground">Gestiona tu calendario y finanzas</p>
        </header>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to="/calendar" className="group">
            <Card className="transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Calendar className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">Calendario</CardTitle>
                <CardDescription>
                  Gestiona tus turnos, eventos y recordatorios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Hoy: </span>
                    <span className="font-medium">{getShiftLabel(calendarSummary.todayShift)}</span>
                  </div>
                  {calendarSummary.nextShiftDay && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Próximo turno: </span>
                      <span className="font-medium">
                        {getShiftLabel(calendarSummary.nextShiftDay.shift)} ({calendarSummary.nextShiftDay.date})
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/cuentas" className="group">
            <Card className="transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Wallet className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">Cuentas</CardTitle>
                <CardDescription>
                  Controla tus gastos e ingresos mensuales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Balance actual: </span>
                    <span className="font-medium">{financesSummary.currentBalance.toFixed(2)}€</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Balance proyectado: </span>
                    <span className={`font-medium ${financesSummary.projectedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {financesSummary.projectedBalance.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/pizarra" className="group">
            <Card className="transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <StickyNote className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">Pizarra</CardTitle>
                <CardDescription>
                  Espacio para notas y recordatorios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Escribe y guarda tus notas importantes
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/nevera" className="group">
            <Card className="transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Refrigerator className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">Nevera</CardTitle>
                <CardDescription>
                  Lista de compras y contenido de la nevera
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Organiza tu lista de la compra
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/domotica" className="group">
            <Card className="transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Home className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">Domótica</CardTitle>
                <CardDescription>
                  Control de dispositivos inteligentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Gestiona tus dispositivos eWeLink
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;

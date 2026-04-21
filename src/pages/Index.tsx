import { Link } from "react-router-dom";
import { Calendar, Wallet, StickyNote, Refrigerator, Home, BarChart3, LinkIcon, CheckSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCalendar } from "@/contexts/CalendarContext";
import { useFinances } from "@/contexts/FinancesContext";
import { useMemo, useEffect, useState } from "react";
import { GlobalBackup } from "@/components/GlobalBackup";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
const Index = () => {
  const { days } = useCalendar();
  const { getTotalBalance, getPendingTransactionsTotal, currentMonth } = useFinances();
  const { user } = useAuth();
  const [taskSummary, setTaskSummary] = useState({ total: 0, done: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [tplRes, compRes] = await Promise.all([
        supabase
          .from("monthly_task_templates")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase
          .from("monthly_task_completions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("month", currentMonth),
      ]);
      setTaskSummary({ total: tplRes.count || 0, done: compRes.count || 0 });
    })();
  }, [user, currentMonth]);

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
      if (days[dateStr]?.shift) {
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
    return shift;
  };

  return (
    <div className="h-[100dvh] bg-background p-3 md:p-6 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-2 md:mb-6">
          <div>
            <h1 className="text-lg md:text-4xl font-bold text-foreground">Panel de Control</h1>
            <p className="text-xs md:text-base text-muted-foreground hidden md:block">Gestiona tu calendario y finanzas</p>
          </div>
          <GlobalBackup />
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 flex-1 min-h-0 auto-rows-fr">
          <Link to="/calendar" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-4 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <Calendar className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Calendario</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Gestiona tus turnos y eventos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
                <div className="space-y-0.5">
                  <div className="text-[10px] md:text-sm">
                    <span className="text-muted-foreground">Hoy: </span>
                    <span className="font-medium">{getShiftLabel(calendarSummary.todayShift)}</span>
                  </div>
                  {calendarSummary.nextShiftDay && (
                    <div className="text-[10px] md:text-sm">
                      <span className="text-muted-foreground">Próx: </span>
                      <span className="font-medium">
                        {getShiftLabel(calendarSummary.nextShiftDay.shift)} ({calendarSummary.nextShiftDay.date})
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/cuentas" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-4 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <Wallet className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Cuentas</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Controla gastos e ingresos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
                <div className="space-y-0.5">
                  <div className="text-[10px] md:text-sm">
                    <span className="text-muted-foreground">Balance: </span>
                    <span className="font-medium">{financesSummary.currentBalance.toFixed(2)}€</span>
                  </div>
                  <div className="text-[10px] md:text-sm">
                    <span className="text-muted-foreground">Proyect: </span>
                    <span className={`font-medium ${financesSummary.projectedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {financesSummary.projectedBalance.toFixed(2)}€
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/pizarra" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-4 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Pizarra</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Notas y recordatorios
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">
                  Notas importantes
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/nevera" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-4 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <Refrigerator className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Nevera</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Cámara de la nevera
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">
                  Lista de la compra
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/domotica" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-4 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <Home className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Domótica</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Dispositivos inteligentes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">
                  Dispositivos eWeLink
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/resumen-financiero" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-6 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Resumen</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Vista detallada de ingresos y gastos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">
                  Movimientos mensuales
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/enlaces" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-6 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Enlaces</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Links a webs importantes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <p className="text-[10px] md:text-sm text-muted-foreground">
                  Proveedores, bancos, seguros...
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/tareas-mes" className="group min-h-0">
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full flex flex-col">
              <CardHeader className="p-3 md:p-6 pb-1 md:pb-2 flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                  <CardTitle className="text-sm md:text-xl">Tareas Mes</CardTitle>
                </div>
                <CardDescription className="text-[10px] md:text-sm hidden lg:block">
                  Ingresos y gastos fijos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <div className="text-[10px] md:text-sm">
                  <span className="text-muted-foreground">Progreso: </span>
                  <span className={`font-medium ${taskSummary.total > 0 && taskSummary.done === taskSummary.total ? 'text-primary' : ''}`}>
                    {taskSummary.done}/{taskSummary.total}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;

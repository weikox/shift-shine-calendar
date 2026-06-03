import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { StorageMethodProvider } from "./hooks/useStorageMethod";
import { CalendarProvider } from "./contexts/CalendarContext";
import { FinancesProvider } from "./contexts/FinancesContext";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import Config from "./pages/Config";
import ConfigEvents from "./pages/ConfigEvents";
import ConfigHolidays from "./pages/ConfigHolidays";
import Finances from "./pages/Finances";
import Auth from "./pages/Auth";
import Pizarra from "./pages/Pizarra";
import Nevera from "./pages/Nevera";
import Domotica from "./pages/Domotica";
import FinancialSummary from "./pages/FinancialSummary";
import Enlaces from "./pages/Enlaces";
import MonthlyTasks from "./pages/MonthlyTasks";
import MonthlyTasksConfig from "./pages/MonthlyTasksConfig";
import CategorizationRules from "./pages/CategorizationRules";
import MonitorRed from "./pages/MonitorRed";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <StorageMethodProvider>
          <CalendarProvider>
            <FinancesProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/config" element={<Config />} />
                  <Route path="/config/eventos" element={<ConfigEvents />} />
                  <Route path="/config/festivos" element={<ConfigHolidays />} />
                  <Route path="/cuentas" element={<Finances />} />
                  <Route path="/cuentas/reglas-categorizacion" element={<CategorizationRules />} />
                  <Route path="/pizarra" element={<Pizarra />} />
                  <Route path="/nevera" element={<Nevera />} />
                  <Route path="/domotica" element={<Domotica />} />
                  <Route path="/resumen-financiero" element={<FinancialSummary />} />
                  <Route path="/enlaces" element={<Enlaces />} />
                  <Route path="/tareas-mes" element={<MonthlyTasks />} />
                  <Route path="/tareas-mes/config" element={<MonthlyTasksConfig />} />
                  <Route path="/monitor-red" element={<MonitorRed />} />
                  <Route path="/auth" element={<Auth />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </FinancesProvider>
          </CalendarProvider>
        </StorageMethodProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

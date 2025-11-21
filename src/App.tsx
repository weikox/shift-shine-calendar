import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CalendarProvider } from "./contexts/CalendarContext";
import { FinancesProvider } from "./contexts/FinancesContext";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import Config from "./pages/Config";
import Finances from "./pages/Finances";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CalendarProvider>
        <FinancesProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/config" element={<Config />} />
              <Route path="/cuentas" element={<Finances />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </FinancesProvider>
      </CalendarProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

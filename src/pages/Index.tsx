import { Link } from "react-router-dom";
import { Calendar, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Panel de Control</h1>
          <p className="text-muted-foreground">Gestiona tu calendario y finanzas</p>
        </header>
        
        <div className="grid md:grid-cols-2 gap-6">
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
                <p className="text-sm text-muted-foreground">
                  Organiza tus turnos de mañana y tarde, añade eventos especiales y configura recordatorios.
                </p>
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
                <p className="text-sm text-muted-foreground">
                  Registra gastos fijos, periódicos, extra y diarios. Gestiona tus ingresos y balance de cuentas.
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

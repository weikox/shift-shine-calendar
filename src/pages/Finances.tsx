import { useState } from "react";
import { useFinances } from "@/contexts/FinancesContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionDialog } from "@/components/TransactionDialog";
import { TransferDialog } from "@/components/TransferDialog";
import { AccountBalanceTable } from "@/components/AccountBalanceTable";
import { TransactionList } from "@/components/TransactionList";
import { FinancesConfig } from "@/components/FinancesConfig";
import { Plus, ArrowLeftRight, Settings, Home } from "lucide-react";
import { Link } from "react-router-dom";

const Finances = () => {
  const { currentMonth, setCurrentMonth, loadPreviousMonth } = useFinances();
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'fixed' | 'periodic' | 'extra' | 'daily' | 'income'>('fixed');
  const [editingTransaction, setEditingTransaction] = useState<string | undefined>();

  const handleAddTransaction = (category: typeof selectedCategory) => {
    setSelectedCategory(category);
    setEditingTransaction(undefined);
    setShowTransactionDialog(true);
  };

  const handleEditTransaction = (id: string, category: typeof selectedCategory) => {
    setSelectedCategory(category);
    setEditingTransaction(id);
    setShowTransactionDialog(true);
  };

  if (showConfig) {
    return <FinancesConfig onClose={() => setShowConfig(false)} />;
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link to="/">
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-3xl font-bold text-foreground truncate">Control de Gastos</h1>
            </div>
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setShowTransferDialog(true)}>
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setShowConfig(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="flex-1 min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 text-sm rounded-md border border-input bg-background"
            />
            <Button variant="outline" size="sm" className="shrink-0 text-xs sm:text-sm" onClick={loadPreviousMonth}>
              Pendientes
            </Button>
          </div>
        </header>

        <Tabs defaultValue="fixed" className="space-y-3 sm:space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="fixed" className="text-[10px] sm:text-sm px-1 sm:px-3 py-1.5">Fijos</TabsTrigger>
            <TabsTrigger value="periodic" className="text-[10px] sm:text-sm px-1 sm:px-3 py-1.5">Periódicos</TabsTrigger>
            <TabsTrigger value="extra" className="text-[10px] sm:text-sm px-1 sm:px-3 py-1.5">Extra</TabsTrigger>
            <TabsTrigger value="daily" className="text-[10px] sm:text-sm px-1 sm:px-3 py-1.5">Diarios</TabsTrigger>
            <TabsTrigger value="income" className="text-[10px] sm:text-sm px-1 sm:px-3 py-1.5">Ingresos</TabsTrigger>
          </TabsList>

          <TabsContent value="fixed" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gastos Fijos</CardTitle>
                    <CardDescription>Gastos mensuales recurrentes</CardDescription>
                  </div>
                  <Button onClick={() => handleAddTransaction('fixed')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TransactionList 
                  category="fixed" 
                  onEdit={(id) => handleEditTransaction(id, 'fixed')}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periodic" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gastos Periódicos</CardTitle>
                    <CardDescription>Gastos anuales, trimestrales, etc.</CardDescription>
                  </div>
                  <Button onClick={() => handleAddTransaction('periodic')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TransactionList 
                  category="periodic" 
                  onEdit={(id) => handleEditTransaction(id, 'periodic')}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extra" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gastos Extra</CardTitle>
                    <CardDescription>Gastos extraordinarios puntuales</CardDescription>
                  </div>
                  <Button onClick={() => handleAddTransaction('extra')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TransactionList 
                  category="extra" 
                  onEdit={(id) => handleEditTransaction(id, 'extra')}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gastos Diarios</CardTitle>
                    <CardDescription>Gastos del día a día</CardDescription>
                  </div>
                  <Button onClick={() => handleAddTransaction('daily')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TransactionList 
                  category="daily" 
                  onEdit={(id) => handleEditTransaction(id, 'daily')}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Ingresos</CardTitle>
                    <CardDescription>Salarios y otros ingresos</CardDescription>
                  </div>
                  <Button onClick={() => handleAddTransaction('income')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TransactionList 
                  category="income" 
                  onEdit={(id) => handleEditTransaction(id, 'income')}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <AccountBalanceTable />
        </div>
      </div>

      <TransactionDialog
        open={showTransactionDialog}
        onOpenChange={setShowTransactionDialog}
        category={selectedCategory}
        transactionId={editingTransaction}
      />

      <TransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
      />
    </div>
  );
};

export default Finances;

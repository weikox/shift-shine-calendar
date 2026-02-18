import { useState } from "react";
import { useFinances, Transaction } from "@/contexts/FinancesContext";
import { FinancialSummaryCard } from "@/components/FinancialSummaryCard";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const FinancialSummary = () => {
  const { currentMonth, setCurrentMonth } = useFinances();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<Transaction["category"]>("daily");
  const [dialogOpen, setDialogOpen] = useState(false);

  const navigateMonth = (delta: number) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = (() => {
    const [y, m] = currentMonth.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  })();

  const handleEditTransaction = (id: string, category: Transaction["category"]) => {
    setEditingId(id);
    setEditCategory(category);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Panel
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <FinancialSummaryCard onEditTransaction={handleEditTransaction} />
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editCategory}
        transactionId={editingId ?? undefined}
      />
    </div>
  );
};

export default FinancialSummary;

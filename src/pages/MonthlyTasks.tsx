import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Paperclip, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFinances } from "@/contexts/FinancesContext";
import { useMonthlyTasks, TaskTemplate } from "@/hooks/useMonthlyTasks";
import { useDocumentStorage } from "@/hooks/useDocumentStorage";
import { useStorageMethod } from "@/hooks/useStorageMethod";

const MonthlyTasks = () => {
  const { user } = useAuth();
  const { currentMonth, setCurrentMonth, addTransaction, deleteTransaction } = useFinances();
  const { storageMethod } = useStorageMethod();
  const { uploadDocument } = useDocumentStorage();
  const { templates, loading, reload, getCompletion } = useMonthlyTasks(currentMonth);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const completedCount = useMemo(
    () => templates.filter((t) => getCompletion(t.id)).length,
    [templates, getCompletion]
  );
  const progress = templates.length > 0 ? (completedCount / templates.length) * 100 : 0;

  const handleStart = (template: TaskTemplate) => {
    const existing = getCompletion(template.id);
    if (existing) return;
    setActiveTaskId(template.id);
    setAmountInput(template.estimated_amount?.toString() || "");
    setPendingFile(null);
  };

  const handleCancel = () => {
    setActiveTaskId(null);
    setAmountInput("");
    setPendingFile(null);
  };

  const handleComplete = async (template: TaskTemplate) => {
    if (!user) return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Introduce un importe válido");
      return;
    }
    if (template.requires_document && !pendingFile) {
      toast.error("Esta tarea requiere adjuntar documento");
      return;
    }

    setSaving(true);
    try {
      // Find account by id → name for FinancesContext
      const { data: accData } = await supabase
        .from("accounts")
        .select("id,name")
        .eq("id", template.account_id)
        .maybeSingle();
      const accountName = accData?.name || "";

      const today = new Date();
      const dateStr = today.toISOString().split("T")[0];

      // Create transaction through existing context (handles both storage modes)
      const txId = addTransaction(
        {
          name: template.name,
          amount,
          account: accountName,
          executed: true,
          category: template.category,
          date: dateStr,
        },
        { silent: true }
      );

      let documentPath: string | null = null;
      if (pendingFile && (storageMethod === "cloud" || storageMethod === "hybrid")) {
        const doc = await uploadDocument(pendingFile, txId);
        if (doc) documentPath = (doc as any).storagePath || (doc as any).storage_path || null;
      }

      // Save completion record
      const { error } = await supabase.from("monthly_task_completions").insert({
        user_id: user.id,
        template_id: template.id,
        month: currentMonth,
        transaction_id: txId,
        amount,
        completion_date: dateStr,
        document_path: documentPath,
      });

      if (error) {
        // rollback transaction if completion insert fails
        deleteTransaction(txId);
        throw error;
      }

      toast.success(`✓ ${template.name}`);
      handleCancel();
      reload();
    } catch (err) {
      console.error(err);
      toast.error("Error al completar la tarea");
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async (template: TaskTemplate) => {
    const comp = getCompletion(template.id);
    if (!comp) return;
    if (!confirm(`¿Deshacer "${template.name}"? Se eliminará el movimiento.`)) return;
    try {
      if (comp.transaction_id) deleteTransaction(comp.transaction_id);
      await supabase.from("monthly_task_completions").delete().eq("id", comp.id);
      toast.success("Tarea deshecha");
      reload();
    } catch {
      toast.error("Error al deshacer");
    }
  };

  return (
    <div className="h-[100dvh] bg-background p-3 md:p-6 flex flex-col overflow-hidden">
      <div className="max-w-5xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <header className="flex items-center gap-2 mb-3 shrink-0">
          <Link to="/">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-bold truncate">Tareas mensuales</h1>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{templates.length} completadas
            </p>
          </div>
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-md border border-input bg-background"
          />
          <Link to="/tareas-mes/config">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </header>

        <Progress value={progress} className="h-1.5 mb-3 shrink-0" />

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <p className="text-muted-foreground text-sm">
                Aún no has definido tareas recurrentes.
              </p>
              <Link to="/tareas-mes/config">
                <Button size="sm">Configurar tareas</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 h-full auto-rows-min content-start">
              {templates.map((t) => {
                const comp = getCompletion(t.id);
                const isActive = activeTaskId === t.id;
                const isDone = !!comp;

                return (
                  <Card
                    key={t.id}
                    className={`transition-all ${
                      isDone ? "bg-green-500/10 border-green-500/40" : ""
                    } ${isActive ? "ring-2 ring-primary" : ""}`}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => (isDone ? handleUndo(t) : handleStart(t))}
                          className={`shrink-0 h-6 w-6 rounded-md border flex items-center justify-center transition-colors ${
                            isDone
                              ? "bg-green-600 border-green-600 text-white"
                              : "hover:bg-muted"
                          }`}
                          aria-label={isDone ? "Deshacer" : "Completar"}
                        >
                          {isDone && <Check className="h-4 w-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-[11px] font-medium truncate">{t.name}</p>
                            {t.requires_document && (
                              <Paperclip className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                            )}
                          </div>
                          {isDone ? (
                            <p className="text-[10px] text-green-700 dark:text-green-400 font-semibold">
                              {comp!.amount.toFixed(2)}€
                            </p>
                          ) : isActive ? (
                            <div className="mt-1 space-y-1">
                              <Input
                                type="number"
                                step="0.01"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                placeholder="Importe €"
                                className="h-6 text-[11px] px-1.5"
                                autoFocus
                              />
                              {t.requires_document && (
                                <>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) =>
                                      setPendingFile(e.target.files?.[0] || null)
                                    }
                                    className="hidden"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-6 text-[10px] w-full justify-start"
                                  >
                                    <Paperclip className="h-3 w-3 mr-1" />
                                    {pendingFile ? pendingFile.name.slice(0, 18) : "Adjuntar"}
                                  </Button>
                                </>
                              )}
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => handleComplete(t)}
                                  disabled={saving}
                                  className="h-6 text-[10px] flex-1"
                                >
                                  {saving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Guardar"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancel}
                                  className="h-6 text-[10px] px-2"
                                >
                                  ✕
                                </Button>
                              </div>
                            </div>
                          ) : (
                            t.estimated_amount && (
                              <p className="text-[10px] text-muted-foreground">
                                ~{t.estimated_amount.toFixed(2)}€
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyTasks;

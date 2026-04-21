import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TaskTemplate {
  id: string;
  name: string;
  account_id: string;
  category: "fixed" | "periodic" | "income";
  tx_type: "gasto" | "ingreso";
  estimated_amount: number | null;
  requires_document: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface TaskCompletion {
  id: string;
  template_id: string;
  month: string;
  transaction_id: string | null;
  amount: number;
  completion_date: string;
  document_path: string | null;
}

export const useMonthlyTasks = (month: string) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tplRes, compRes] = await Promise.all([
        supabase
          .from("monthly_task_templates")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("monthly_task_completions")
          .select("*")
          .eq("user_id", user.id)
          .eq("month", month),
      ]);
      if (tplRes.data) setTemplates(tplRes.data as TaskTemplate[]);
      if (compRes.data) setCompletions(compRes.data as TaskCompletion[]);
    } finally {
      setLoading(false);
    }
  }, [user, month]);

  useEffect(() => {
    load();
  }, [load]);

  const getCompletion = (templateId: string) =>
    completions.find((c) => c.template_id === templateId) || null;

  return { templates, completions, loading, reload: load, getCompletion };
};

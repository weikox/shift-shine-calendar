-- Plantillas de tareas recurrentes mensuales
CREATE TABLE public.monthly_task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'fixed', -- fixed | periodic | income
  tx_type TEXT NOT NULL DEFAULT 'gasto',  -- gasto | ingreso
  estimated_amount NUMERIC,
  requires_document BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monthly_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task templates" ON public.monthly_task_templates
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own task templates" ON public.monthly_task_templates
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own task templates" ON public.monthly_task_templates
FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own task templates" ON public.monthly_task_templates
FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_task_templates_updated_at
BEFORE UPDATE ON public.monthly_task_templates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Completaciones mensuales
CREATE TABLE public.monthly_task_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.monthly_task_templates(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- 'YYYY-MM'
  transaction_id UUID,
  amount NUMERIC NOT NULL,
  completion_date DATE NOT NULL,
  document_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, month)
);

ALTER TABLE public.monthly_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task completions" ON public.monthly_task_completions
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own task completions" ON public.monthly_task_completions
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own task completions" ON public.monthly_task_completions
FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own task completions" ON public.monthly_task_completions
FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_task_completions_updated_at
BEFORE UPDATE ON public.monthly_task_completions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_task_completions_month ON public.monthly_task_completions(user_id, month);
CREATE INDEX idx_task_templates_user ON public.monthly_task_templates(user_id, sort_order);
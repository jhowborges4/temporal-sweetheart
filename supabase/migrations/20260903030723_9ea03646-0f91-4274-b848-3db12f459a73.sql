CREATE TABLE public.vendas_diarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  data DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_diarias TO authenticated;
GRANT ALL ON public.vendas_diarias TO service_role;
ALTER TABLE public.vendas_diarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gerenciam suas vendas" ON public.vendas_diarias FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_vendas_diarias_updated_at BEFORE UPDATE ON public.vendas_diarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
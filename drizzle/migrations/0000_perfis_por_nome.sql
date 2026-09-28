CREATE TABLE public.perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_normalizado text NOT NULL UNIQUE,
  nome_exibicao text NOT NULL,
  config jsonb,
  historico jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.perfis TO service_role;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.vendas_nome (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  venda_id text NOT NULL,
  data date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, data)
);
GRANT ALL ON public.vendas_nome TO service_role;
ALTER TABLE public.vendas_nome ENABLE ROW LEVEL SECURITY;
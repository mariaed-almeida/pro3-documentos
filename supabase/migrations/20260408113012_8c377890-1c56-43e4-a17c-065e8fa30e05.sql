
CREATE TABLE public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  nome text NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

-- Anyone can read active campaigns
CREATE POLICY "Anyone can view active campaigns" ON public.campanhas
  FOR SELECT TO anon USING (ativa = true);

CREATE POLICY "Authenticated can view all campaigns" ON public.campanhas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage campaigns" ON public.campanhas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update campaigns" ON public.campanhas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete campaigns" ON public.campanhas
  FOR DELETE TO authenticated USING (true);

-- Seed initial data
INSERT INTO public.campanhas (cliente, nome) VALUES
  ('ALESC', '2026 - Demandas Bancadas Regionais - Fevereiro'),
  ('ALESC', '2026 - Institucional'),
  ('ALESC', '2026 - Sessões Especiais'),
  ('Prefeitura de Xanxerê', '2026 - Obras e Infraestrutura'),
  ('Prefeitura de Xanxerê', '2026 - Saúde Municipal'),
  ('Prefeitura de Xanxerê', '2026 - Educação'),
  ('Prefeitura de Chapecó', '2026 - Desenvolvimento Urbano'),
  ('Prefeitura de Chapecó', '2026 - Cultura e Turismo'),
  ('Prefeitura de Chapecó', '2026 - Serviços Públicos');

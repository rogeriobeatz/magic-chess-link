CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  white_token text NOT NULL,
  black_token text,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read games" ON public.games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "create games" ON public.games FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update games" ON public.games FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
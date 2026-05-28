-- Conferences module: conference list + checklist tracking

CREATE TABLE IF NOT EXISTS public.conferences (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  title       text        NOT NULL,
  venue       text,
  start_date  date,
  end_date    date,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conference_checklist_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid        NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  phase         text        NOT NULL CHECK (phase IN ('pre', 'during', 'post')),
  title         text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  sort_order    integer     NOT NULL DEFAULT 0,
  completed     boolean     NOT NULL DEFAULT false,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Ensure all required columns exist even when table was partially created earlier
ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.conferences
SET name = COALESCE(name, title)
WHERE name IS NULL;

UPDATE public.conferences
SET title = COALESCE(title, name, 'Untitled Conference')
WHERE title IS NULL;

ALTER TABLE public.conferences
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.conference_checklist_items
  ADD COLUMN IF NOT EXISTS conference_id uuid,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated full access" ON public.conferences;
CREATE POLICY "authenticated full access" ON public.conferences
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated full access" ON public.conference_checklist_items;
CREATE POLICY "authenticated full access" ON public.conference_checklist_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_conferences_updated_at ON public.conferences;
CREATE TRIGGER set_conferences_updated_at
  BEFORE UPDATE ON public.conferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_conference_checklist_items_updated_at ON public.conference_checklist_items;
CREATE TRIGGER set_conference_checklist_items_updated_at
  BEFORE UPDATE ON public.conference_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ask PostgREST (used by Supabase APIs) to refresh schema cache
NOTIFY pgrst, 'reload schema';

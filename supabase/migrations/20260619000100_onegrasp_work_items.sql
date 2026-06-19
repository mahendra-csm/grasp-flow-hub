-- OneGrasp Work task board

CREATE TABLE IF NOT EXISTS public.onegrasp_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assignee_name text NOT NULL,
  assignee_email text,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date,
  completed_at timestamptz,
  created_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onegrasp_work_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS assignee_name text,
  ADD COLUMN IF NOT EXISTS assignee_email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_email text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.onegrasp_work_items
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN assignee_name SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'todo',
  ALTER COLUMN priority SET DEFAULT 'medium',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onegrasp_work_items_status_check'
  ) THEN
    ALTER TABLE public.onegrasp_work_items
      ADD CONSTRAINT onegrasp_work_items_status_check
      CHECK (status IN ('todo', 'in_progress', 'review', 'done'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onegrasp_work_items_priority_check'
  ) THEN
    ALTER TABLE public.onegrasp_work_items
      ADD CONSTRAINT onegrasp_work_items_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS onegrasp_work_items_status_idx
  ON public.onegrasp_work_items (status);

CREATE INDEX IF NOT EXISTS onegrasp_work_items_due_date_idx
  ON public.onegrasp_work_items (due_date);

CREATE INDEX IF NOT EXISTS onegrasp_work_items_assignee_name_idx
  ON public.onegrasp_work_items (lower(assignee_name));

ALTER TABLE public.onegrasp_work_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onegrasp work items are viewable by authenticated users" ON public.onegrasp_work_items;
CREATE POLICY "onegrasp work items are viewable by authenticated users"
  ON public.onegrasp_work_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated users can insert onegrasp work items" ON public.onegrasp_work_items;
CREATE POLICY "authenticated users can insert onegrasp work items"
  ON public.onegrasp_work_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated users can update onegrasp work items" ON public.onegrasp_work_items;
CREATE POLICY "authenticated users can update onegrasp work items"
  ON public.onegrasp_work_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated users can delete onegrasp work items" ON public.onegrasp_work_items;
CREATE POLICY "authenticated users can delete onegrasp work items"
  ON public.onegrasp_work_items
  FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_onegrasp_work_items_updated_at ON public.onegrasp_work_items;
CREATE TRIGGER set_onegrasp_work_items_updated_at
  BEFORE UPDATE ON public.onegrasp_work_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';

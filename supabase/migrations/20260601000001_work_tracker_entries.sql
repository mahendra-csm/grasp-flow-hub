-- Daily work tracker for outreach and extraction activity

CREATE TABLE IF NOT EXISTS public.work_tracker_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  work_date date NOT NULL,
  emails_sent_conferences integer NOT NULL DEFAULT 0 CHECK (emails_sent_conferences >= 0),
  emails_sent_scientific_members integer NOT NULL DEFAULT 0 CHECK (emails_sent_scientific_members >= 0),
  whatsapp_messages_sent integer NOT NULL DEFAULT 0 CHECK (whatsapp_messages_sent >= 0),
  email_extraction_count integer NOT NULL DEFAULT 0 CHECK (email_extraction_count >= 0),
  contact_extraction_count integer NOT NULL DEFAULT 0 CHECK (contact_extraction_count >= 0),
  ad_campaign_leads_count integer NOT NULL DEFAULT 0 CHECK (ad_campaign_leads_count >= 0),
  ad_campaign_country_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_tracker_entries_country_breakdown_is_array
    CHECK (jsonb_typeof(ad_campaign_country_breakdown) = 'array')
);

ALTER TABLE public.work_tracker_entries
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS work_date date,
  ADD COLUMN IF NOT EXISTS emails_sent_conferences integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_scientific_members integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_messages_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_extraction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_extraction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_campaign_leads_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_campaign_country_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.work_tracker_entries
  ALTER COLUMN owner_id SET NOT NULL,
  ALTER COLUMN owner_email SET NOT NULL,
  ALTER COLUMN work_date SET NOT NULL,
  ALTER COLUMN ad_campaign_country_breakdown SET DEFAULT '[]'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS work_tracker_entries_owner_date_idx
  ON public.work_tracker_entries (owner_id, work_date);

CREATE INDEX IF NOT EXISTS work_tracker_entries_work_date_idx
  ON public.work_tracker_entries (work_date DESC);

ALTER TABLE public.work_tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work tracker entries are viewable by authenticated users" ON public.work_tracker_entries;
CREATE POLICY "work tracker entries are viewable by authenticated users"
  ON public.work_tracker_entries
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users can insert their own work tracker entries" ON public.work_tracker_entries;
CREATE POLICY "users can insert their own work tracker entries"
  ON public.work_tracker_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "users can update their own work tracker entries" ON public.work_tracker_entries;
CREATE POLICY "users can update their own work tracker entries"
  ON public.work_tracker_entries
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "users can delete their own work tracker entries" ON public.work_tracker_entries;
CREATE POLICY "users can delete their own work tracker entries"
  ON public.work_tracker_entries
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_work_tracker_entries_updated_at ON public.work_tracker_entries;
CREATE TRIGGER set_work_tracker_entries_updated_at
  BEFORE UPDATE ON public.work_tracker_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';

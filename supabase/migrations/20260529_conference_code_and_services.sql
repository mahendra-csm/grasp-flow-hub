-- Website integration support:
--   1. Add `code` to conferences so leads from WordPress can be linked
--      to their source conference by the conf_code carried in custom_data.
--   2. Seed default services that match what the website forms send
--      (`service: "Conferences"` and `service: "Counselling"`) so the
--      webhook can attach service_id automatically. Idempotent.

ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS code text;

CREATE UNIQUE INDEX IF NOT EXISTS conferences_code_unique
  ON public.conferences (code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_custom_data_conf_code
  ON public.leads ((custom_data->>'conf_code'));

CREATE INDEX IF NOT EXISTS idx_leads_custom_data_form_type
  ON public.leads ((custom_data->>'form_type'));

-- Seed services used by the website forms. ON CONFLICT keeps existing rows
-- untouched so admins can recolor/rename without losing changes on re-run.
INSERT INTO public.services (name, slug, description, icon, color, active, sort_order)
VALUES
  ('Conferences', 'conferences',
   'Conference registrations, abstract submissions and related enquiries from onegrasp.com',
   'CalendarDays', '#ff7a59', true, 10),
  ('Counselling', 'counselling',
   'Free counselling bookings from onegrasp.com',
   'MessageCircle', '#22c55e', true, 20)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';


-- Enums
CREATE TYPE public.lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.pipeline_stage AS ENUM ('new', 'contacted', 'interested', 'follow_up', 'documents_pending', 'payment_pending', 'converted', 'closed', 'lost');
CREATE TYPE public.followup_status AS ENUM ('pending', 'completed', 'overdue', 'cancelled');
CREATE TYPE public.field_type AS ENUM ('text', 'textarea', 'number', 'email', 'phone', 'date', 'select', 'multiselect', 'checkbox');

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Briefcase',
  color TEXT DEFAULT '#ff7a59',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  country TEXT,
  city TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  source TEXT,
  priority public.lead_priority NOT NULL DEFAULT 'medium',
  stage public.pipeline_stage NOT NULL DEFAULT 'new',
  notes TEXT,
  follow_up_date TIMESTAMPTZ,
  custom_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_leads_service ON public.leads(service_id);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);

-- Activities (timeline)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_lead ON public.activities(lead_id, created_at DESC);

-- Follow-ups
CREATE TABLE public.followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ NOT NULL,
  status public.followup_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_followups_due ON public.followups(due_date);
CREATE INDEX idx_followups_lead ON public.followups(lead_id);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_lead ON public.documents(lead_id);

-- Dynamic form fields per service
CREATE TABLE public.dynamic_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type public.field_type NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, field_key)
);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER tr_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tr_followups_updated BEFORE UPDATE ON public.followups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_form_fields ENABLE ROW LEVEL SECURITY;

-- Admin-only CRM: any authenticated user has full access
CREATE POLICY "auth full access" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.followups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.dynamic_form_fields FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('lead-documents', 'lead-documents', false);

CREATE POLICY "auth read documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lead-documents');
CREATE POLICY "auth upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-documents');
CREATE POLICY "auth update documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lead-documents');
CREATE POLICY "auth delete documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lead-documents');

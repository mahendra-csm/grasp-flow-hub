-- Security hardening and webhook reliability

-- Role helpers
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    auth.jwt() -> 'user_metadata' ->> 'role',
    'employee'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_user_role() = 'admin';
$$;

-- Webhook key hardening: hash-only storage (compatible migration)
ALTER TABLE public.webhook_keys
  ADD COLUMN IF NOT EXISTS api_key_hash text,
  ADD COLUMN IF NOT EXISTS key_prefix text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

UPDATE public.webhook_keys
SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
WHERE api_key IS NOT NULL
  AND api_key_hash IS NULL;

UPDATE public.webhook_keys
SET key_prefix = left(api_key, 16)
WHERE api_key IS NOT NULL
  AND key_prefix IS NULL;

ALTER TABLE public.webhook_keys
  ALTER COLUMN api_key_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_keys_hash_unique
  ON public.webhook_keys (api_key_hash);

-- keep legacy api_key column temporarily for backward compatibility but clear existing plaintext
UPDATE public.webhook_keys
SET api_key = NULL
WHERE api_key IS NOT NULL;

REVOKE EXECUTE ON FUNCTION public.manage_webhook_key(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_webhook_key(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_webhook_lead(uuid, text, text, text, text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_webhook_key(uuid, text) TO authenticated;

-- Idempotent inbox for provider webhooks
CREATE TABLE IF NOT EXISTS public.webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, external_id)
);

ALTER TABLE public.webhook_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can view webhook inbox" ON public.webhook_inbox;
CREATE POLICY "admins can view webhook inbox"
  ON public.webhook_inbox
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "service role writes webhook inbox" ON public.webhook_inbox;
CREATE POLICY "service role writes webhook inbox"
  ON public.webhook_inbox
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Invitations: secure redemption flow (no direct token reads from client)
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage invitations" ON public.invitations;
CREATE POLICY "admin manage invitations"
  ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "users read own profile"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admin insert profiles" ON public.profiles;
CREATE POLICY "admin insert profiles"
  ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin delete profiles" ON public.profiles;
CREATE POLICY "admin delete profiles"
  ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.claim_invitation(p_token text, p_email text)
RETURNS TABLE (invitation_id uuid, email text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.invitations i
  SET used = true
  WHERE i.token = p_token
    AND lower(i.email) = lower(p_email)
    AND i.used = false
    AND (i.expires_at IS NULL OR i.expires_at > now())
  RETURNING i.id, i.email, i.role;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_invitation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_invitation(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_invitation_claim(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invitations
  SET used = false
  WHERE id = p_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.release_invitation_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_invitation_claim(uuid) TO service_role;

-- Ensure profile role can still be initialized when invitation already claimed
CREATE OR REPLACE FUNCTION public.handle_new_user_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invited_role text;
BEGIN
  SELECT i.role INTO invited_role
  FROM public.invitations i
  WHERE lower(i.email) = lower(NEW.email)
  ORDER BY i.created_at DESC
  LIMIT 1;

  INSERT INTO public.profiles (id, role, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'role', invited_role, 'employee'),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

-- Restrict broad table policies to admin/ownership aware policies
DROP POLICY IF EXISTS "auth full access" ON public.services;
CREATE POLICY "services read authenticated"
  ON public.services FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "services write admin"
  ON public.services FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth full access" ON public.dynamic_form_fields;
CREATE POLICY "dynamic fields read authenticated"
  ON public.dynamic_form_fields FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "dynamic fields write admin"
  ON public.dynamic_form_fields FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth full access" ON public.leads;
CREATE POLICY "leads select scoped"
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (created_by IS NULL AND assigned_to IS NULL)
  );
CREATE POLICY "leads insert scoped"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR created_by IS NULL
    OR created_by = auth.uid()
  );
CREATE POLICY "leads update scoped"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  );
CREATE POLICY "leads delete admin"
  ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "auth full access" ON public.activities;
CREATE POLICY "activities scoped"
  ON public.activities FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = activities.lead_id
        AND (
          l.created_by = auth.uid()
          OR l.assigned_to = auth.uid()
          OR (l.created_by IS NULL AND l.assigned_to IS NULL)
        )
    )
  );
CREATE POLICY "activities write scoped"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR created_by = auth.uid()
  );
CREATE POLICY "activities update admin"
  ON public.activities FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY "activities delete admin"
  ON public.activities FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "auth full access" ON public.followups;
CREATE POLICY "followups scoped"
  ON public.followups FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = followups.lead_id
        AND (
          l.created_by = auth.uid()
          OR l.assigned_to = auth.uid()
          OR (l.created_by IS NULL AND l.assigned_to IS NULL)
        )
    )
  );
CREATE POLICY "followups write scoped"
  ON public.followups FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR created_by = auth.uid());
CREATE POLICY "followups update scoped"
  ON public.followups FOR UPDATE TO authenticated
  USING (public.is_admin() OR created_by = auth.uid())
  WITH CHECK (public.is_admin() OR created_by = auth.uid());
CREATE POLICY "followups delete admin"
  ON public.followups FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "auth full access" ON public.documents;
CREATE POLICY "documents scoped"
  ON public.documents FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR uploaded_by = auth.uid()
  );
CREATE POLICY "documents insert scoped"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR uploaded_by = auth.uid() OR uploaded_by IS NULL);
CREATE POLICY "documents update scoped"
  ON public.documents FOR UPDATE TO authenticated
  USING (public.is_admin() OR uploaded_by = auth.uid())
  WITH CHECK (public.is_admin() OR uploaded_by = auth.uid());
CREATE POLICY "documents delete scoped"
  ON public.documents FOR DELETE TO authenticated
  USING (public.is_admin() OR uploaded_by = auth.uid());

DROP POLICY IF EXISTS "authenticated full access" ON public.conferences;
CREATE POLICY "conferences read authenticated"
  ON public.conferences FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "conferences write admin"
  ON public.conferences FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "authenticated full access" ON public.conference_checklist_items;
CREATE POLICY "conference checklist read authenticated"
  ON public.conference_checklist_items FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "conference checklist write admin"
  ON public.conference_checklist_items FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "authenticated full access" ON public.conference_templates;
CREATE POLICY "conference templates read authenticated"
  ON public.conference_templates FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "conference templates write admin"
  ON public.conference_templates FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "onegrasp work items are viewable by authenticated users" ON public.onegrasp_work_items;
DROP POLICY IF EXISTS "authenticated users can insert onegrasp work items" ON public.onegrasp_work_items;
DROP POLICY IF EXISTS "authenticated users can update onegrasp work items" ON public.onegrasp_work_items;
DROP POLICY IF EXISTS "authenticated users can delete onegrasp work items" ON public.onegrasp_work_items;

CREATE POLICY "onegrasp work items read authenticated"
  ON public.onegrasp_work_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "onegrasp work items insert scoped"
  ON public.onegrasp_work_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR created_by_id = auth.uid());

CREATE POLICY "onegrasp work items update scoped"
  ON public.onegrasp_work_items
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR created_by_id = auth.uid())
  WITH CHECK (public.is_admin() OR created_by_id = auth.uid());

CREATE POLICY "onegrasp work items delete admin"
  ON public.onegrasp_work_items
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Storage hardening for lead documents
DROP POLICY IF EXISTS "auth read documents" ON storage.objects;
DROP POLICY IF EXISTS "auth upload documents" ON storage.objects;
DROP POLICY IF EXISTS "auth update documents" ON storage.objects;
DROP POLICY IF EXISTS "auth delete documents" ON storage.objects;

CREATE POLICY "documents storage read scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-documents' AND public.is_admin());

CREATE POLICY "documents storage write scoped"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-documents' AND public.is_admin());

CREATE POLICY "documents storage update scoped"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lead-documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'lead-documents' AND public.is_admin());

CREATE POLICY "documents storage delete scoped"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents' AND public.is_admin());

NOTIFY pgrst, 'reload schema';

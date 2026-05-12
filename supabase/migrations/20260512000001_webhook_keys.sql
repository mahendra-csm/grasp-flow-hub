-- Stores one API key per CRM user. No service role key required — key management
-- is done via SECURITY DEFINER RPC functions callable with the anon key.
CREATE TABLE IF NOT EXISTS public.webhook_keys (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL,
  api_key     text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT  webhook_keys_user_unique UNIQUE (user_id)
);

ALTER TABLE public.webhook_keys ENABLE ROW LEVEL SECURITY;

-- Authenticated users can still read/delete their own rows from the client if needed
DROP POLICY IF EXISTS "own key" ON public.webhook_keys;
CREATE POLICY "own key" ON public.webhook_keys
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── manage_webhook_key ──────────────────────────────────────────────────────
-- Called from server functions to generate / get / revoke a key for a given
-- user.  Runs as db owner so it bypasses RLS.
CREATE OR REPLACE FUNCTION public.manage_webhook_key(p_user_id uuid, p_action text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_action = 'generate' THEN
    v_key := 'ogk_live_'
          || replace(p_user_id::text, '-', '')
          || '_'
          || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO webhook_keys (user_id, api_key)
      VALUES (p_user_id, v_key)
      ON CONFLICT (user_id) DO UPDATE SET api_key = v_key, created_at = now();
    RETURN v_key;

  ELSIF p_action = 'get' THEN
    SELECT api_key INTO v_key FROM webhook_keys WHERE user_id = p_user_id;
    RETURN v_key;

  ELSIF p_action = 'revoke' THEN
    DELETE FROM webhook_keys WHERE user_id = p_user_id;
    RETURN null;
  END IF;

  RETURN null;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_webhook_key FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.manage_webhook_key TO anon, authenticated;

-- ─── verify_webhook_key ──────────────────────────────────────────────────────
-- Used by the webhook HTTP endpoint to validate an incoming Bearer token and
-- return the owner's user_id.  Returns NULL if the key does not exist.
CREATE OR REPLACE FUNCTION public.verify_webhook_key(p_key text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT user_id FROM webhook_keys WHERE api_key = p_key LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_webhook_key FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_webhook_key TO anon, authenticated;

-- ─── insert_webhook_lead ─────────────────────────────────────────────────────
-- Inserts a lead attributed to the verified user.  Called after
-- verify_webhook_key succeeds, so no JWT is required by the caller.
CREATE OR REPLACE FUNCTION public.insert_webhook_lead(
  p_user_id    uuid,
  p_full_name  text,
  p_email      text    DEFAULT NULL,
  p_phone      text    DEFAULT NULL,
  p_whatsapp   text    DEFAULT NULL,
  p_source     text    DEFAULT 'Website',
  p_custom_data jsonb  DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO leads (full_name, email, phone, whatsapp, source, created_by, custom_data)
    VALUES (p_full_name, p_email, p_phone, p_whatsapp, p_source, p_user_id, p_custom_data)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_webhook_lead FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.insert_webhook_lead TO anon, authenticated;

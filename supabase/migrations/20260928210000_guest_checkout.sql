-- Guest checkout: buyers pay first and the account is created from the email
-- they enter at Stripe Checkout (see stripe-webhook and claim-checkout).

-- Set when claim-checkout hands the buyer a sign-in session, so the Stripe
-- session id in the success URL can only log someone in once.
ALTER TABLE purchase_events ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Lets the webhook find an existing account for a checkout email.
CREATE OR REPLACE FUNCTION find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;

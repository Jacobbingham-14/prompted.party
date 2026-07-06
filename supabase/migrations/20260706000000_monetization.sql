-- Monetization: purchasable game modes + purchasable image-generation credits
-- Fixes a pre-existing bug: check_generation_limit() (see 20260416000000_add_avatar_and_rpcs.sql)
-- reads user_game_stats.generation_limit, but that column was never created, so every
-- host has silently been capped at the hardcoded 100-generation fallback with no way to
-- raise it. This migration adds the column (default 100 = free trial) and a way to top it up.

-- 1. Add the missing, purchasable credit ceiling
ALTER TABLE user_game_stats
  ADD COLUMN IF NOT EXISTS generation_limit integer NOT NULL DEFAULT 100;

-- 2. Track which one-time game modes a host has unlocked
CREATE TABLE IF NOT EXISTS purchased_game_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_mode text NOT NULL CHECK (game_mode IN ('judge', 'voting', 'forgery', 'duel')),
  stripe_payment_intent_id text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, game_mode)
);

ALTER TABLE purchased_game_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view their own unlocked modes"
  ON purchased_game_modes FOR SELECT
  USING (auth.uid() = host_id);
-- No client-side INSERT/UPDATE policy: unlocks are only ever written by the
-- stripe-webhook edge function using the service role key, after payment confirmation.

-- 3. Ledger of every credit/mode purchase, for support + reconciliation
CREATE TABLE IF NOT EXISTS purchase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  kind text NOT NULL CHECK (kind IN ('game_mode', 'game_mode_bundle', 'credits')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"modes":["judge","duel"]} or {"credits":250}
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view their own purchase history"
  ON purchase_events FOR SELECT
  USING (auth.uid() = host_id);

-- 4. RPC used by the webhook (service role) to atomically grant credits
CREATE OR REPLACE FUNCTION grant_generation_credits(p_host_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_game_stats (host_id, generation_limit)
  VALUES (p_host_id, 100 + p_amount)
  ON CONFLICT (host_id) DO UPDATE
    SET generation_limit = user_game_stats.generation_limit + p_amount,
        updated_at = now();
END;
$$;

-- 5. RPC used by the webhook (service role) to unlock one or more game modes
CREATE OR REPLACE FUNCTION grant_game_modes(p_host_id uuid, p_modes text[], p_payment_intent_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO purchased_game_modes (host_id, game_mode, stripe_payment_intent_id)
  SELECT p_host_id, m, p_payment_intent_id
  FROM unnest(p_modes) AS m
  ON CONFLICT (host_id, game_mode) DO NOTHING;
END;
$$;

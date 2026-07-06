-- Per-game-mode prompt management
--
-- Today: Judge + Voting modes share one global `prompts` table (plus a
-- `custom_prompts` review queue), while Duel and Forgery each have their own
-- table (duel_prompts, forgery_prompts) with NO admin write policy at all --
-- meaning there was previously no way to manage Duel/Forgery prompts except
-- direct SQL. This migration:
--   1. Creates judge_prompts + voting_prompts (seeded from the old shared
--      `prompts` table) so every mode has its own independent pool.
--   2. Adds category tags + soft-archive to all four per-mode tables.
--   3. Adds admin write policies to duel_prompts/forgery_prompts (previously
--      read-only at the RLS level).
-- The old `prompts` table is left in place, untouched, in case anything else
-- still references it -- it's simply no longer read by the game itself.

CREATE TABLE IF NOT EXISTS judge_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  category text[] NOT NULL DEFAULT '{}',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voting_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  category text[] NOT NULL DEFAULT '{}',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO judge_prompts (text, created_at)
  SELECT text, created_at FROM prompts
  ON CONFLICT DO NOTHING;

INSERT INTO voting_prompts (text, created_at)
  SELECT text, created_at FROM prompts
  ON CONFLICT DO NOTHING;

ALTER TABLE judge_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view judge prompts" ON judge_prompts FOR SELECT USING (true);
CREATE POLICY "Admins can manage judge prompts" ON judge_prompts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view voting prompts" ON voting_prompts FOR SELECT USING (true);
CREATE POLICY "Admins can manage voting prompts" ON voting_prompts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE duel_prompts ADD COLUMN IF NOT EXISTS category text[] NOT NULL DEFAULT '{}';
ALTER TABLE duel_prompts ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE forgery_prompts ADD COLUMN IF NOT EXISTS category text[] NOT NULL DEFAULT '{}';
ALTER TABLE forgery_prompts ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE POLICY "Admins can manage duel prompts" ON duel_prompts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage forgery prompts" ON forgery_prompts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

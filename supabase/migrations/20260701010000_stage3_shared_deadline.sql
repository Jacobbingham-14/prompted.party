-- Stage 3: Shared timer deadline
-- Adds a single deadline_at column to rounds. When the host transitions the
-- round into a timed phase (prompt-voting, judging, image-voting,
-- forgery-voting, etc.) they write the shared end-time to this column. Every
-- client (host screen and each player's phone) computes remaining time from
-- deadline_at - Date.now(), so countdowns stay in sync across devices and
-- players who join mid-phase see the correct remaining time.

ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

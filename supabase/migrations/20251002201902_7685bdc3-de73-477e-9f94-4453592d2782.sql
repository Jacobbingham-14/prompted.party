-- Make host_id nullable since we set it after creating the player
ALTER TABLE public.rooms ALTER COLUMN host_id DROP NOT NULL;
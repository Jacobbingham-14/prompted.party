-- Create custom_prompts table to track player-generated prompts
CREATE TABLE public.custom_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  judge_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  promoted BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.custom_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can insert custom prompts (no auth required for gameplay)
CREATE POLICY "Anyone can insert custom prompts"
ON public.custom_prompts
FOR INSERT
WITH CHECK (true);

-- Only admins can view custom prompts
CREATE POLICY "Admins can view custom prompts"
ON public.custom_prompts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update custom prompts
CREATE POLICY "Admins can update custom prompts"
ON public.custom_prompts
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete custom prompts
CREATE POLICY "Admins can delete custom prompts"
ON public.custom_prompts
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_custom_prompts_promoted ON public.custom_prompts(promoted);
CREATE INDEX idx_custom_prompts_reviewed ON public.custom_prompts(reviewed);
CREATE INDEX idx_custom_prompts_created_at ON public.custom_prompts(created_at DESC);
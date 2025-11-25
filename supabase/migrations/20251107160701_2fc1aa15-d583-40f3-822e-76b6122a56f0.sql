-- Create suggestions table with user tracking
CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can insert suggestions with their own user_id
CREATE POLICY "Authenticated users can insert suggestions"
  ON public.suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only authenticated users can view suggestions
CREATE POLICY "Authenticated users can view suggestions"
  ON public.suggestions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can update suggestions
CREATE POLICY "Authenticated users can update suggestions"
  ON public.suggestions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_suggestions_created_at ON public.suggestions(created_at DESC);
CREATE INDEX idx_suggestions_status ON public.suggestions(status);
CREATE INDEX idx_suggestions_user_id ON public.suggestions(user_id);
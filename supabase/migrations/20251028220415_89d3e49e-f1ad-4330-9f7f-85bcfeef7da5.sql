-- Add prompt column to rounds table
ALTER TABLE public.rounds ADD COLUMN prompt TEXT;

-- Create prompts table for storing preset prompts
CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on prompts table
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read prompts
CREATE POLICY "Anyone can view prompts"
ON public.prompts
FOR SELECT
USING (true);

-- Only authenticated users can insert prompts (for admin purposes)
CREATE POLICY "Authenticated users can create prompts"
ON public.prompts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Insert some default prompts to get started
INSERT INTO public.prompts (text, category) VALUES
  ('A cat wearing a top hat reading a newspaper in a Victorian library', 'animals'),
  ('A robot chef making pizza in a futuristic kitchen', 'sci-fi'),
  ('A dragon sleeping on a pile of gold coins in a cave', 'fantasy'),
  ('A penguin surfing on a giant wave during sunset', 'nature'),
  ('A wizard''s study filled with floating books and magical artifacts', 'fantasy'),
  ('An astronaut gardening on Mars with alien plants', 'sci-fi'),
  ('A steampunk airship flying through clouds at dawn', 'steampunk'),
  ('A medieval knight having tea with a friendly dinosaur', 'humor'),
  ('An underwater city with mermaids and glowing jellyfish', 'fantasy'),
  ('A cozy hobbit home with a round door and garden', 'fantasy');
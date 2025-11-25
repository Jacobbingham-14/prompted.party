-- Enable authenticated users to delete and update prompts
CREATE POLICY "Authenticated users can delete prompts"
ON public.prompts
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update prompts"
ON public.prompts
FOR UPDATE
TO authenticated
USING (true);

-- Drop the category column
ALTER TABLE public.prompts DROP COLUMN IF EXISTS category;

-- Enable realtime for prompts table
ALTER PUBLICATION supabase_realtime ADD TABLE public.prompts;
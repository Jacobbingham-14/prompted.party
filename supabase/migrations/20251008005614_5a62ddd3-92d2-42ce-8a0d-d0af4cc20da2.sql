-- Create storage bucket for game images
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('game-images', 'game-images', true, 5242880);

-- Allow anyone to upload images to game-images bucket
CREATE POLICY "Anyone can upload game images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'game-images');

-- Allow anyone to view images from game-images bucket
CREATE POLICY "Anyone can view game images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'game-images');
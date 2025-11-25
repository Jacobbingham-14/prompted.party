-- Update game-images bucket file size limit from 5MB to 20MB
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'game-images';
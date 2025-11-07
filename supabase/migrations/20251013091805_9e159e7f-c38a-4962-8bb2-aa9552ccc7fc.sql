-- Add description column to topics table
ALTER TABLE public.topics 
ADD COLUMN description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.topics.description IS '主題的詳細描述，最多500字元';
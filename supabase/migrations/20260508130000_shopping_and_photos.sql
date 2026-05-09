-- Shared shopping list (any household member can add / check off / delete).
-- Idempotent: re-running this whole file will not error.
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  added_by UUID REFERENCES public.household_members(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.household_members(id) ON DELETE SET NULL
);

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all shopping_items" ON public.shopping_items;
CREATE POLICY "Allow all shopping_items" ON public.shopping_items FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_shopping_items_household ON public.shopping_items(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_added_at ON public.shopping_items(household_id, added_at);

-- Photo proof: optional URL stored on each completion row.
ALTER TABLE public.completions ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Public Storage bucket for completion photos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-proofs', 'task-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "task-proofs read" ON storage.objects;
DROP POLICY IF EXISTS "task-proofs write" ON storage.objects;
DROP POLICY IF EXISTS "task-proofs delete" ON storage.objects;

CREATE POLICY "task-proofs read" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-proofs');
CREATE POLICY "task-proofs write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'task-proofs');
CREATE POLICY "task-proofs delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'task-proofs');

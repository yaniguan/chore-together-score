-- Shared shopping list (any household member can add / check off / delete).
CREATE TABLE public.shopping_items (
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
CREATE POLICY "Allow all shopping_items" ON public.shopping_items FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;

CREATE INDEX idx_shopping_items_household ON public.shopping_items(household_id);
CREATE INDEX idx_shopping_items_added_at ON public.shopping_items(household_id, added_at);

-- Photo proof: optional URL stored on each completion row. Lives in the
-- "task-proofs" Storage bucket created below.
ALTER TABLE public.completions ADD COLUMN photo_url TEXT;

-- Public Storage bucket for completion photos. The 2-person trust model
-- mirrors the rest of the app's permissive policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-proofs', 'task-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "task-proofs read" ON storage.objects;
DROP POLICY IF EXISTS "task-proofs write" ON storage.objects;
DROP POLICY IF EXISTS "task-proofs delete" ON storage.objects;

CREATE POLICY "task-proofs read" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-proofs');
CREATE POLICY "task-proofs write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'task-proofs');
CREATE POLICY "task-proofs delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'task-proofs');

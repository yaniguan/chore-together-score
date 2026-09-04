-- Manual ordering for tasks on the Today page.
--
-- Idempotent: safe to run more than once. Existing rows keep the order they
-- already appear in (creation order within their area), so nothing visibly
-- moves until someone actually drags something.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill only rows that have no position yet, numbering within each
-- household + category. Gaps of 10 leave room, though the app rewrites the
-- whole category on every drop anyway.
WITH ordered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY household_id, category ORDER BY created_at, id)) * 10 AS seq
  FROM public.tasks
  WHERE sort_order IS NULL
)
UPDATE public.tasks AS t
SET sort_order = ordered.seq
FROM ordered
WHERE t.id = ordered.id;

CREATE INDEX IF NOT EXISTS tasks_household_sort_idx
  ON public.tasks (household_id, sort_order);

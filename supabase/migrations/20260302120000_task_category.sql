-- Add category column to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

-- Back-fill seed tasks based on name patterns (best-effort for existing data)
UPDATE public.tasks SET category = 'dog'         WHERE name ILIKE '%dog%' OR name ILIKE '%pet%';
UPDATE public.tasks SET category = 'kitchen'     WHERE name ILIKE '%grocery%' OR name ILIKE '%cook%' OR name ILIKE '%dish%' OR name ILIKE '%kitchen%';
UPDATE public.tasks SET category = 'bathroom'    WHERE name ILIKE '%toilet%' OR name ILIKE '%bathroom%' OR name ILIKE '%shower%';
UPDATE public.tasks SET category = 'bedroom'     WHERE name ILIKE '%laundry%' OR name ILIKE '%bedroom%' OR name ILIKE '%bed%';
UPDATE public.tasks SET category = 'living_room' WHERE name ILIKE '%sweep%' OR name ILIKE '%mop%' OR name ILIKE '%floor%' OR name ILIKE '%vacuum%' OR name ILIKE '%trash%' OR name ILIKE '%living%';

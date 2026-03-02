
-- Households table
CREATE TABLE public.households (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Our Home',
  pin TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Household members (exactly 2 per household)
CREATE TABLE public.household_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#0D9488',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏠',
  frequency TEXT NOT NULL DEFAULT 'daily',
  frequency_value INTEGER DEFAULT 1,
  max_per_cycle INTEGER NOT NULL DEFAULT 1,
  points INTEGER NOT NULL DEFAULT 5,
  assigned_to TEXT NOT NULL DEFAULT 'both',
  color_tag TEXT NOT NULL DEFAULT '#0D9488',
  created_by UUID REFERENCES public.household_members(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Completions (immutable log)
CREATE TABLE public.completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  points_earned INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for anon access (this is a trust-based 2-person app)
-- Households
CREATE POLICY "Allow all access to households" ON public.households FOR ALL USING (true) WITH CHECK (true);

-- Members
CREATE POLICY "Allow all access to members" ON public.household_members FOR ALL USING (true) WITH CHECK (true);

-- Tasks
CREATE POLICY "Allow all access to tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- Completions: allow insert and select, no update (prevent score editing)
CREATE POLICY "Allow read completions" ON public.completions FOR SELECT USING (true);
CREATE POLICY "Allow insert completions" ON public.completions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete completions" ON public.completions FOR DELETE USING (true);

-- Enable realtime for tasks and completions
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;

-- Create indexes
CREATE INDEX idx_tasks_household ON public.tasks(household_id);
CREATE INDEX idx_completions_household ON public.completions(household_id);
CREATE INDEX idx_completions_task ON public.completions(task_id);
CREATE INDEX idx_completions_member ON public.completions(member_id);
CREATE INDEX idx_completions_date ON public.completions(completed_at);
CREATE INDEX idx_members_household ON public.household_members(household_id);

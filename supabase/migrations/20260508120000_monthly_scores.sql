-- Monthly archive: at month-end the totals are frozen here so that
-- available points can reset cleanly each month.
CREATE TABLE public.monthly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_spent INTEGER NOT NULL DEFAULT 0,
  finalized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (household_id, member_id, year_month)
);

ALTER TABLE public.monthly_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all monthly_scores" ON public.monthly_scores FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_scores;

CREATE INDEX idx_monthly_scores_household ON public.monthly_scores(household_id);
CREATE INDEX idx_monthly_scores_year_month ON public.monthly_scores(household_id, year_month);

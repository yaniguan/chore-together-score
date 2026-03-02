-- Rewards table (custom rewards per household)
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎁',
  points_cost INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Redemptions table (immutable log of reward redemptions)
CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  reward_name TEXT NOT NULL,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- Permissive policies (trust-based 2-person app)
CREATE POLICY "Allow all rewards" ON public.rewards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read redemptions" ON public.redemptions FOR SELECT USING (true);
CREATE POLICY "Allow insert redemptions" ON public.redemptions FOR INSERT WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rewards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.redemptions;

-- Indexes
CREATE INDEX idx_rewards_household ON public.rewards(household_id);
CREATE INDEX idx_redemptions_household ON public.redemptions(household_id);
CREATE INDEX idx_redemptions_member ON public.redemptions(member_id);

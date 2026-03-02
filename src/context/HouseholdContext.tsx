import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseStoredHouseholdMember } from '@/lib/householdStorage';

export interface HouseholdMember {
  id: string;
  household_id: string;
  display_name: string;
  avatar_color: string;
}

export interface Task {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  category: string;
  frequency: string;
  frequency_value: number | null;
  max_per_cycle: number;
  points: number;
  assigned_to: string;
  color_tag: string;
  created_by: string | null;
  created_at: string;
}

export interface Completion {
  id: string;
  task_id: string;
  household_id: string;
  member_id: string;
  points_earned: number;
  completed_at: string;
}

export interface Reward {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  points_cost: number;
  created_at: string;
  category: string | null;
}

export interface Redemption {
  id: string;
  household_id: string;
  member_id: string;
  reward_id: string | null;
  reward_name: string;
  points_spent: number;
  redeemed_at: string;
}

interface HouseholdContextType {
  householdId: string | null;
  currentMember: HouseholdMember | null;
  members: HouseholdMember[];
  tasks: Task[];
  completions: Completion[];
  allTimePoints: Record<string, number>;
  rewards: Reward[];
  redemptions: Redemption[];
  availablePoints: Record<string, number>;
  setCurrentMember: (member: HouseholdMember) => void;
  setHouseholdId: (id: string) => void;
  logout: () => void;
  refreshData: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);
const HOUSEHOLD_ID_STORAGE_KEY = 'homepace_household_id';
const MEMBER_STORAGE_KEY = 'homepace_member';

export const useHousehold = () => {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
};

const SEED_TASKS = [
  { name: 'Walk the dog',    icon: '🐕',  category: 'dog',         frequency: 'daily',  frequency_value: 1, max_per_cycle: 5, points: 5,  color_tag: '#0D9488' },
  { name: 'Feed the dog',    icon: '🍖',  category: 'dog',         frequency: 'daily',  frequency_value: 1, max_per_cycle: 2, points: 3,  color_tag: '#0D9488' },
  { name: 'Sweep floor',     icon: '🧹',  category: 'living_room', frequency: 'daily',  frequency_value: 1, max_per_cycle: 2, points: 4,  color_tag: '#F59E0B' },
  { name: 'Mop floor',       icon: '🪣',  category: 'living_room', frequency: 'daily',  frequency_value: 1, max_per_cycle: 2, points: 6,  color_tag: '#F59E0B' },
  { name: 'Grocery shopping',icon: '🛒',  category: 'kitchen',     frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 10, color_tag: '#8B5CF6' },
  { name: 'Clean toilet',    icon: '🚽',  category: 'bathroom',    frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 8,  color_tag: '#EC4899' },
  { name: 'Do laundry',      icon: '👕',  category: 'bedroom',     frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 7,  color_tag: '#3B82F6' },
  { name: 'Take out trash',  icon: '🗑️', category: 'living_room', frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 5,  color_tag: '#6B7280' },
];

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [householdId, setHouseholdIdState] = useState<string | null>(() => localStorage.getItem(HOUSEHOLD_ID_STORAGE_KEY));
  const [currentMember, setCurrentMemberState] = useState<HouseholdMember | null>(() => {
    const stored = localStorage.getItem(MEMBER_STORAGE_KEY);
    const parsed = parseStoredHouseholdMember(stored);

    if (stored && !parsed) {
      localStorage.removeItem(MEMBER_STORAGE_KEY);
    }

    return parsed;
  });
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [allTimePoints, setAllTimePoints] = useState<Record<string, number>>({});
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  const setHouseholdId = (id: string) => {
    localStorage.setItem(HOUSEHOLD_ID_STORAGE_KEY, id);
    setHouseholdIdState(id);
  };

  const setCurrentMember = (member: HouseholdMember) => {
    localStorage.setItem(MEMBER_STORAGE_KEY, JSON.stringify(member));
    setCurrentMemberState(member);
  };

  const logout = () => {
    localStorage.removeItem(HOUSEHOLD_ID_STORAGE_KEY);
    localStorage.removeItem(MEMBER_STORAGE_KEY);
    setHouseholdIdState(null);
    setCurrentMemberState(null);
    setMembers([]);
    setTasks([]);
    setCompletions([]);
    setAllTimePoints({});
    setRewards([]);
    setRedemptions([]);
  };

  const refreshData = useCallback(async () => {
    if (!householdId) return;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [membersRes, tasksRes, completionsRes, allPtsRes, rewardsRes, redemptionsRes] = await Promise.all([
      supabase.from('household_members').select('*').eq('household_id', householdId),
      supabase.from('tasks').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('completions').select('*')
        .eq('household_id', householdId)
        .gte('completed_at', ninetyDaysAgo.toISOString())
        .order('completed_at', { ascending: false }),
      supabase.from('completions').select('member_id, points_earned').eq('household_id', householdId),
      supabase.from('rewards').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('redemptions').select('*').eq('household_id', householdId).order('redeemed_at', { ascending: false }),
    ]);

    if (membersRes.data) setMembers(membersRes.data as HouseholdMember[]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (completionsRes.data) setCompletions(completionsRes.data as Completion[]);

    if (allPtsRes.data) {
      const pts: Record<string, number> = {};
      for (const row of allPtsRes.data) {
        pts[row.member_id] = (pts[row.member_id] ?? 0) + row.points_earned;
      }
      setAllTimePoints(pts);
    }

    if (rewardsRes.data) setRewards(rewardsRes.data as Reward[]);
    if (redemptionsRes.data) setRedemptions(redemptionsRes.data as Redemption[]);
  }, [householdId]);

  // Seed tasks for new household
  const seedTasks = useCallback(async (hId: string) => {
    const { data: existing } = await supabase.from('tasks').select('id').eq('household_id', hId).limit(1);
    if (existing && existing.length > 0) return;

    const tasksToInsert = SEED_TASKS.map(t => ({
      ...t,
      household_id: hId,
      assigned_to: 'both',
    }));
    await supabase.from('tasks').insert(tasksToInsert);
  }, []);

  useEffect(() => {
    if (householdId) {
      seedTasks(householdId).then(() => refreshData());
    }
  }, [householdId, seedTasks, refreshData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!householdId) return;

    const channel = supabase
      .channel('homepace-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `household_id=eq.${householdId}` }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions', filter: `household_id=eq.${householdId}` }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards', filter: `household_id=eq.${householdId}` }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions', filter: `household_id=eq.${householdId}` }, () => refreshData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [householdId, refreshData]);

  // availablePoints = allTimePoints - sum of redemptions per member
  const availablePoints = useMemo(() => {
    const spent: Record<string, number> = {};
    for (const r of redemptions) {
      spent[r.member_id] = (spent[r.member_id] ?? 0) + r.points_spent;
    }
    const result: Record<string, number> = {};
    for (const memberId of Object.keys(allTimePoints)) {
      result[memberId] = (allTimePoints[memberId] ?? 0) - (spent[memberId] ?? 0);
    }
    return result;
  }, [allTimePoints, redemptions]);

  return (
    <HouseholdContext.Provider value={{
      householdId, currentMember, members, tasks, completions,
      allTimePoints, rewards, redemptions, availablePoints,
      setCurrentMember, setHouseholdId, logout, refreshData,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
};

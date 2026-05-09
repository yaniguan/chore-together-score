import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseStoredHouseholdMember } from '@/lib/householdStorage';
import { getMonthKey, getMonthRange } from '@/lib/monthCycle';

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
  photo_url: string | null;
}

export interface ShoppingItem {
  id: string;
  household_id: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  added_by: string | null;
  added_at: string;
  completed_at: string | null;
  completed_by: string | null;
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

export interface MonthlyScore {
  id: string;
  household_id: string;
  member_id: string;
  year_month: string;
  points_earned: number;
  points_spent: number;
  finalized_at: string;
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
  monthlyScores: MonthlyScore[];
  shoppingItems: ShoppingItem[];
  monthEarned: Record<string, number>;
  monthSpent: Record<string, number>;
  availablePoints: Record<string, number>;
  setCurrentMember: (member: HouseholdMember) => void;
  setHouseholdId: (id: string) => void;
  logout: () => void;
  refreshData: () => Promise<void>;
  resetTasksToDefaults: () => Promise<void>;
  uploadProofPhoto: (file: File) => Promise<string | null>;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);
const HOUSEHOLD_ID_STORAGE_KEY = 'homepace_household_id';
const MEMBER_STORAGE_KEY = 'homepace_member';

export const useHousehold = () => {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
};

// Default Chinese task list (categories: kitchen / bathroom / dog / other).
export const SEED_TASKS = [
  // 厨房 Kitchen
  { name: '做饭',       icon: '🍳',  category: 'kitchen',  frequency: 'daily',  frequency_value: 1, max_per_cycle: 3, points: 5, color_tag: '#F59E0B' },
  { name: '收拾',       icon: '🧽',  category: 'kitchen',  frequency: 'daily',  frequency_value: 1, max_per_cycle: 3, points: 3, color_tag: '#F59E0B' },
  { name: '灶台',       icon: '🔥',  category: 'kitchen',  frequency: 'daily',  frequency_value: 1, max_per_cycle: 1, points: 3, color_tag: '#F59E0B' },
  { name: '微波炉',     icon: '📦',  category: 'kitchen',  frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 3, color_tag: '#F59E0B' },
  { name: '洗碗池',     icon: '🚰',  category: 'kitchen',  frequency: 'daily',  frequency_value: 1, max_per_cycle: 1, points: 4, color_tag: '#F59E0B' },
  { name: '冰箱',       icon: '🧊',  category: 'kitchen',  frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 5, color_tag: '#F59E0B' },
  { name: '大理石板',   icon: '🪨',  category: 'kitchen',  frequency: 'daily',  frequency_value: 1, max_per_cycle: 1, points: 3, color_tag: '#F59E0B' },
  { name: '扔垃圾(厨房)', icon: '🗑️', category: 'kitchen',  frequency: 'daily',  frequency_value: 1, max_per_cycle: 2, points: 3, color_tag: '#F59E0B' },
  // 厕所 Bathroom
  { name: '浴缸',       icon: '🛁',  category: 'bathroom', frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 6, color_tag: '#EC4899' },
  { name: '马桶',       icon: '🚽',  category: 'bathroom', frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 5, color_tag: '#EC4899' },
  { name: '镜子',       icon: '🪞',  category: 'bathroom', frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 2, color_tag: '#EC4899' },
  { name: '洗脸池',     icon: '🚿',  category: 'bathroom', frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 3, color_tag: '#EC4899' },
  { name: '扔垃圾(厕所)', icon: '🗑️', category: 'bathroom', frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 2, color_tag: '#EC4899' },
  // 狗 Dog
  { name: '遛狗',       icon: '🐕',  category: 'dog',      frequency: 'daily',  frequency_value: 1, max_per_cycle: 3, points: 5, color_tag: '#0D9488' },
  { name: '喂饭',       icon: '🍖',  category: 'dog',      frequency: 'daily',  frequency_value: 1, max_per_cycle: 2, points: 3, color_tag: '#0D9488' },
  { name: '刷牙',       icon: '🪥',  category: 'dog',      frequency: 'daily',  frequency_value: 1, max_per_cycle: 1, points: 2, color_tag: '#0D9488' },
  { name: '洗澡',       icon: '🛀',  category: 'dog',      frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 8, color_tag: '#0D9488' },
  // 其他综合 Other
  { name: '扫地',       icon: '🧹',  category: 'other',    frequency: 'daily',  frequency_value: 1, max_per_cycle: 1, points: 4, color_tag: '#6B7280' },
  { name: '拖地',       icon: '🪣',  category: 'other',    frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 6, color_tag: '#6B7280' },
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
  const [monthlyScores, setMonthlyScores] = useState<MonthlyScore[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);

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
    setMonthlyScores([]);
    setShoppingItems([]);
  };

  const refreshData = useCallback(async () => {
    if (!householdId) return;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [membersRes, tasksRes, completionsRes, allPtsRes, rewardsRes, redemptionsRes, monthlyRes, shoppingRes] = await Promise.all([
      supabase.from('household_members').select('*').eq('household_id', householdId),
      supabase.from('tasks').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('completions').select('*')
        .eq('household_id', householdId)
        .gte('completed_at', ninetyDaysAgo.toISOString())
        .order('completed_at', { ascending: false }),
      supabase.from('completions').select('member_id, points_earned').eq('household_id', householdId),
      supabase.from('rewards').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('redemptions').select('*').eq('household_id', householdId).order('redeemed_at', { ascending: false }),
      supabase.from('monthly_scores').select('*').eq('household_id', householdId).order('year_month', { ascending: false }),
      supabase.from('shopping_items').select('*').eq('household_id', householdId).order('added_at', { ascending: false }),
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
    if (monthlyRes.data) setMonthlyScores(monthlyRes.data as MonthlyScore[]);
    if (shoppingRes.data) setShoppingItems(shoppingRes.data as ShoppingItem[]);
  }, [householdId]);

  // Upload a proof photo to the public "task-proofs" bucket and return the
  // resulting public URL (or null on error). Caller stores the URL on the
  // completion row.
  const uploadProofPhoto = useCallback(async (file: File): Promise<string | null> => {
    if (!householdId) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('task-proofs').upload(path, file, {
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
    if (error) {
      // Surface to console with full detail; caller shows a user-facing toast.
      console.error('uploadProofPhoto failed', error.message, error);
      return null;
    }
    const { data } = supabase.storage.from('task-proofs').getPublicUrl(path);
    return data.publicUrl ?? null;
  }, [householdId]);

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

  const resetTasksToDefaults = useCallback(async () => {
    if (!householdId) return;
    // Delete current tasks (cascades to their completions). Monthly archive
    // rows are preserved because they don't reference task ids.
    await supabase.from('tasks').delete().eq('household_id', householdId);
    const tasksToInsert = SEED_TASKS.map(t => ({
      ...t,
      household_id: householdId,
      assigned_to: 'both',
      created_by: currentMember?.id ?? null,
    }));
    await supabase.from('tasks').insert(tasksToInsert);
    await refreshData();
  }, [householdId, currentMember, refreshData]);

  // Archive any past months that haven't been archived yet. Idempotent.
  const archiveRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!householdId || members.length === 0) return;
    // Run once per (household, current month) per page-load.
    const runKey = `${householdId}:${getMonthKey(new Date())}`;
    if (archiveRunRef.current === runKey) return;
    archiveRunRef.current = runKey;

    (async () => {
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [firstCRes, firstRRes, archivesRes] = await Promise.all([
        supabase.from('completions').select('completed_at').eq('household_id', householdId).order('completed_at', { ascending: true }).limit(1),
        supabase.from('redemptions').select('redeemed_at').eq('household_id', householdId).order('redeemed_at', { ascending: true }).limit(1),
        supabase.from('monthly_scores').select('year_month').eq('household_id', householdId),
      ]);

      const earliestCandidates: Date[] = [];
      if (firstCRes.data?.[0]?.completed_at) earliestCandidates.push(new Date(firstCRes.data[0].completed_at));
      if (firstRRes.data?.[0]?.redeemed_at) earliestCandidates.push(new Date(firstRRes.data[0].redeemed_at));
      if (earliestCandidates.length === 0) return;

      const earliest = earliestCandidates.reduce((a, b) => (a < b ? a : b));
      const archived = new Set(archivesRes.data?.map(r => r.year_month) ?? []);
      const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
      const rowsToInsert: { household_id: string; member_id: string; year_month: string; points_earned: number; points_spent: number }[] = [];

      while (cursor < startOfThisMonth) {
        const ym = getMonthKey(cursor);
        if (!archived.has(ym)) {
          const { start, end } = getMonthRange(cursor);
          const [eRes, sRes] = await Promise.all([
            supabase.from('completions').select('member_id, points_earned')
              .eq('household_id', householdId)
              .gte('completed_at', start.toISOString())
              .lt('completed_at', end.toISOString()),
            supabase.from('redemptions').select('member_id, points_spent')
              .eq('household_id', householdId)
              .gte('redeemed_at', start.toISOString())
              .lt('redeemed_at', end.toISOString()),
          ]);
          const eMap: Record<string, number> = {};
          const sMap: Record<string, number> = {};
          for (const r of eRes.data ?? []) eMap[r.member_id] = (eMap[r.member_id] ?? 0) + r.points_earned;
          for (const r of sRes.data ?? []) sMap[r.member_id] = (sMap[r.member_id] ?? 0) + r.points_spent;
          for (const m of members) {
            rowsToInsert.push({
              household_id: householdId,
              member_id: m.id,
              year_month: ym,
              points_earned: eMap[m.id] ?? 0,
              points_spent: sMap[m.id] ?? 0,
            });
          }
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }

      if (rowsToInsert.length > 0) {
        await supabase.from('monthly_scores').upsert(rowsToInsert, { onConflict: 'household_id,member_id,year_month' });
        await refreshData();
      }
    })();
  }, [householdId, members, refreshData]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_scores', filter: `household_id=eq.${householdId}` }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` }, () => refreshData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [householdId, refreshData]);

  // Current month earned (from completions) and spent (from redemptions).
  // availablePoints = current month earned minus current month spent — past
  // months are frozen in monthly_scores and don't bleed into this number.
  const monthEarned = useMemo(() => {
    const { start, end } = getMonthRange(new Date());
    const m: Record<string, number> = {};
    for (const c of completions) {
      const t = new Date(c.completed_at);
      if (t >= start && t < end) m[c.member_id] = (m[c.member_id] ?? 0) + c.points_earned;
    }
    return m;
  }, [completions]);

  const monthSpent = useMemo(() => {
    const { start, end } = getMonthRange(new Date());
    const m: Record<string, number> = {};
    for (const r of redemptions) {
      const t = new Date(r.redeemed_at);
      if (t >= start && t < end) m[r.member_id] = (m[r.member_id] ?? 0) + r.points_spent;
    }
    return m;
  }, [redemptions]);

  const availablePoints = useMemo(() => {
    const result: Record<string, number> = {};
    for (const m of members) {
      result[m.id] = (monthEarned[m.id] ?? 0) - (monthSpent[m.id] ?? 0);
    }
    return result;
  }, [members, monthEarned, monthSpent]);

  return (
    <HouseholdContext.Provider value={{
      householdId, currentMember, members, tasks, completions,
      allTimePoints, rewards, redemptions, monthlyScores, shoppingItems,
      monthEarned, monthSpent, availablePoints,
      setCurrentMember, setHouseholdId, logout, refreshData,
      resetTasksToDefaults, uploadProofPhoto,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseStoredHouseholdMember } from '@/lib/householdStorage';
import { getMonthKey, getMonthRange } from '@/lib/monthCycle';
import { SEED_TASKS } from '@/lib/seedTasks';

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
  sort_order: number | null;
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
  rewards: Reward[];
  redemptions: Redemption[];
  monthlyScores: MonthlyScore[];
  shoppingItems: ShoppingItem[];
  loadError: string | null;
  monthEarned: Record<string, number>;
  monthSpent: Record<string, number>;
  availablePoints: Record<string, number>;
  setCurrentMember: (member: HouseholdMember) => void;
  setHouseholdId: (id: string) => void;
  logout: () => void;
  refreshData: () => Promise<void>;
  resetTasksToDefaults: () => Promise<void>;
  /** Persists a new manual order for the given task ids, in the order supplied. */
  reorderTasks: (orderedIds: string[]) => Promise<boolean>;
  uploadProofPhoto: (file: File) => Promise<string | null>;
  // Optimistic mutators — pages call these to update local state before the
  // server round-trip; on failure they call again to roll back. Realtime /
  // refreshData reconciles the truth afterwards.
  mutateCompletions: (fn: (prev: Completion[]) => Completion[]) => void;
  mutateShoppingItems: (fn: (prev: ShoppingItem[]) => ShoppingItem[]) => void;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);
const HOUSEHOLD_ID_STORAGE_KEY = 'homepace_household_id';
const MEMBER_STORAGE_KEY = 'homepace_member';

export const useHousehold = () => {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
};

// Manual order first, then creation order for anything not yet positioned
// (rows created before the sort_order migration, or inserted since).
const byManualOrder = (a: Task, b: Task) => {
  const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.created_at.localeCompare(b.created_at);
};

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
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [monthlyScores, setMonthlyScores] = useState<MonthlyScore[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    setRewards([]);
    setRedemptions([]);
    setMonthlyScores([]);
    setShoppingItems([]);
  };

  const refreshData = useCallback(async () => {
    if (!householdId) return;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [membersRes, tasksRes, completionsRes, rewardsRes, redemptionsRes, monthlyRes, shoppingRes] = await Promise.all([
      supabase.from('household_members').select('*').eq('household_id', householdId),
      supabase.from('tasks').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('completions').select('*')
        .eq('household_id', householdId)
        .gte('completed_at', ninetyDaysAgo.toISOString())
        .order('completed_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('redemptions').select('*').eq('household_id', householdId).order('redeemed_at', { ascending: false }),
      supabase.from('monthly_scores').select('*').eq('household_id', householdId).order('year_month', { ascending: false }),
      supabase.from('shopping_items').select('*').eq('household_id', householdId).order('added_at', { ascending: false }),
    ]);

    // Surface load failures instead of silently rendering an empty household —
    // "No tasks yet" when the database is unreachable reads as data loss.
    const firstError = [membersRes, tasksRes, completionsRes, rewardsRes, redemptionsRes, monthlyRes, shoppingRes]
      .map(r => r.error)
      .find(Boolean);
    if (firstError) {
      console.error('refreshData failed', firstError);
      setLoadError(firstError.message || '无法连接数据库');
      return;
    }
    setLoadError(null);

    if (membersRes.data) setMembers(membersRes.data as HouseholdMember[]);
    if (tasksRes.data) setTasks([...(tasksRes.data as Task[])].sort(byManualOrder));
    if (completionsRes.data) setCompletions(completionsRes.data as Completion[]);
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

  /**
   * Writes a new manual order. Optimistic: the list reorders locally first and
   * rolls back if the write fails. Degrades with a clear message when the
   * sort_order migration has not been applied to this database yet.
   */
  const reorderTasks = useCallback(async (orderedIds: string[]): Promise<boolean> => {
    if (!householdId || orderedIds.length === 0) return false;

    const position = new Map(orderedIds.map((id, i) => [id, (i + 1) * 10]));
    let previous: Task[] = [];
    setTasks(prev => {
      previous = prev;
      return [...prev]
        .map(t => (position.has(t.id) ? { ...t, sort_order: position.get(t.id)! } : t))
        .sort(byManualOrder);
    });

    const results = await Promise.all(
      orderedIds.map(id =>
        supabase.from('tasks').update({ sort_order: position.get(id)! }).eq('id', id),
      ),
    );
    const failure = results.map(r => r.error).find(Boolean);
    if (failure) {
      console.error('reorderTasks failed', failure);
      setTasks(previous);
      const missingColumn = /sort_order/.test(failure.message) &&
        /column|schema cache/i.test(failure.message);
      toast.error(
        missingColumn
          ? '数据库还没有 sort_order 字段，请先在 Supabase 里跑排序迁移 SQL'
          : `排序保存失败: ${failure.message}`,
        { duration: 6000 },
      );
      return false;
    }
    return true;
  }, [householdId]);

  /**
   * Inserts the default list, positioned in the order it is written in
   * lib/seedTasks. Falls back to inserting without positions so a database
   * that has not had the sort_order migration applied still gets its tasks
   * rather than silently ending up empty.
   */
  const insertSeedTasks = useCallback(async (hId: string, createdBy: string | null) => {
    const base = SEED_TASKS.map(t => ({
      ...t,
      household_id: hId,
      assigned_to: 'both',
      created_by: createdBy,
    }));
    const positioned = base.map((t, i) => ({ ...t, sort_order: (i + 1) * 10 }));

    const { error } = await supabase.from('tasks').insert(positioned);
    if (!error) return;

    if (/sort_order/.test(error.message)) {
      const retry = await supabase.from('tasks').insert(base);
      if (!retry.error) return;
      throw new Error(retry.error.message);
    }
    throw new Error(error.message);
  }, []);

  const seedTasks = useCallback(async (hId: string) => {
    const { data: existing } = await supabase.from('tasks').select('id').eq('household_id', hId).limit(1);
    if (existing && existing.length > 0) return;
    await insertSeedTasks(hId, null);
  }, [insertSeedTasks]);

  const resetTasksToDefaults = useCallback(async () => {
    if (!householdId) return;
    // Delete current tasks (cascades to their completions). Monthly archive
    // rows are preserved because they don't reference task ids.
    const { error } = await supabase.from('tasks').delete().eq('household_id', householdId);
    if (error) throw new Error(error.message);
    await insertSeedTasks(householdId, currentMember?.id ?? null);
    await refreshData();
  }, [householdId, currentMember, refreshData, insertSeedTasks]);

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
    if (!householdId) return;
    // Seeding is best-effort: load the household either way, so a failure here
    // surfaces as the connection banner rather than a blank screen.
    seedTasks(householdId)
      .catch(e => console.error('seedTasks failed', e))
      .finally(() => { refreshData(); });
  }, [householdId, seedTasks, refreshData]);

  // Realtime subscriptions. Every table change used to fire a full refresh, so
  // a burst of taps meant a burst of 7-query round-trips on both devices —
  // debounce so a burst collapses into one refresh.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!householdId) return;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        refreshData();
      }, 400);
    };

    const tables = ['tasks', 'completions', 'household_members', 'rewards',
                    'redemptions', 'monthly_scores', 'shopping_items'] as const;

    let channel = supabase.channel('homepace-realtime');
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
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
      rewards, redemptions, monthlyScores, shoppingItems, loadError,
      monthEarned, monthSpent, availablePoints,
      setCurrentMember, setHouseholdId, logout, refreshData,
      resetTasksToDefaults, reorderTasks, uploadProofPhoto,
      mutateCompletions: setCompletions,
      mutateShoppingItems: setShoppingItems,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
};

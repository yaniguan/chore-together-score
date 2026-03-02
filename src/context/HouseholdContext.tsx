import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

interface HouseholdContextType {
  householdId: string | null;
  currentMember: HouseholdMember | null;
  members: HouseholdMember[];
  tasks: Task[];
  completions: Completion[];
  setCurrentMember: (member: HouseholdMember) => void;
  setHouseholdId: (id: string) => void;
  logout: () => void;
  refreshData: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);

export const useHousehold = () => {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
};

const SEED_TASKS = [
  { name: 'Walk the dog', icon: '🐕', frequency: 'daily', frequency_value: 1, max_per_cycle: 5, points: 5, color_tag: '#0D9488' },
  { name: 'Feed the dog', icon: '🍖', frequency: 'daily', frequency_value: 1, max_per_cycle: 2, points: 3, color_tag: '#0D9488' },
  { name: 'Sweep floor', icon: '🧹', frequency: 'daily', frequency_value: 1, max_per_cycle: 2, points: 4, color_tag: '#F59E0B' },
  { name: 'Mop floor', icon: '🪣', frequency: 'daily', frequency_value: 1, max_per_cycle: 2, points: 6, color_tag: '#F59E0B' },
  { name: 'Grocery shopping', icon: '🛒', frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 10, color_tag: '#8B5CF6' },
  { name: 'Clean toilet', icon: '🚽', frequency: 'weekly', frequency_value: 2, max_per_cycle: 1, points: 8, color_tag: '#EC4899' },
  { name: 'Do laundry', icon: '👕', frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 7, color_tag: '#3B82F6' },
  { name: 'Take out trash', icon: '🗑️', frequency: 'weekly', frequency_value: 1, max_per_cycle: 1, points: 5, color_tag: '#6B7280' },
];

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [householdId, setHouseholdIdState] = useState<string | null>(() => localStorage.getItem('homepace_household_id'));
  const [currentMember, setCurrentMemberState] = useState<HouseholdMember | null>(() => {
    const stored = localStorage.getItem('homepace_member');
    return stored ? JSON.parse(stored) : null;
  });
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);

  const setHouseholdId = (id: string) => {
    localStorage.setItem('homepace_household_id', id);
    setHouseholdIdState(id);
  };

  const setCurrentMember = (member: HouseholdMember) => {
    localStorage.setItem('homepace_member', JSON.stringify(member));
    setCurrentMemberState(member);
  };

  const logout = () => {
    localStorage.removeItem('homepace_household_id');
    localStorage.removeItem('homepace_member');
    setHouseholdIdState(null);
    setCurrentMemberState(null);
    setMembers([]);
    setTasks([]);
    setCompletions([]);
  };

  const refreshData = useCallback(async () => {
    if (!householdId) return;

    const [membersRes, tasksRes, completionsRes] = await Promise.all([
      supabase.from('household_members').select('*').eq('household_id', householdId),
      supabase.from('tasks').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('completions').select('*').eq('household_id', householdId).order('completed_at', { ascending: false }),
    ]);

    if (membersRes.data) setMembers(membersRes.data as HouseholdMember[]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (completionsRes.data) setCompletions(completionsRes.data as Completion[]);
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [householdId, refreshData]);

  return (
    <HouseholdContext.Provider value={{
      householdId, currentMember, members, tasks, completions,
      setCurrentMember, setHouseholdId, logout, refreshData,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
};

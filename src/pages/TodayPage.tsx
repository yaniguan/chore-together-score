import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useHousehold, Completion } from '@/context/HouseholdContext';
import TaskCard from '@/components/TaskCard';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Star, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES } from '@/lib/constants';
import { getDayBounds, getTaskCompletionsForDate, calculateStreak } from '@/lib/completions';
import { useNotifications } from '@/hooks/useNotifications';
import { useDailyReminder } from '@/hooks/useDailyReminder';

const TodayPage: React.FC = () => {
  const { tasks, completions, currentMember, members, refreshData, householdId } = useHousehold();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [otherDateCompletions, setOtherDateCompletions] = useState<Completion[]>([]);
  const [loadingOther, setLoadingOther] = useState(false);
  const [loggingTask, setLoggingTask] = useState<Record<string, boolean>>({});

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const daysWithCompletions = useMemo(() => {
    const s = new Set<string>();
    for (const c of completions) {
      const d = new Date(c.completed_at);
      s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return s;
  }, [completions]);

  const selectedDayBounds = useMemo(() => getDayBounds(selectedDate), [selectedDate]);

  const dayPoints = useMemo(() => {
    let src;
    if (isToday) {
      const todayStart = getDayBounds(new Date()).start;
      src = completions.filter(c => new Date(c.completed_at) >= todayStart);
    } else {
      src = otherDateCompletions;
    }
    return members.map(m => ({
      ...m,
      pts: src
        .filter(c => c.member_id === m.id)
        .reduce((s, c) => s + c.points_earned, 0),
    }));
  }, [isToday, completions, otherDateCompletions, members]);

  // Memoized grouped tasks (same pattern as TasksPage)
  const groupedTasks = useMemo(() =>
    CATEGORIES
      .map(cat => ({ ...cat, tasks: tasks.filter(t => (t.category ?? 'other') === cat.value) }))
      .filter(g => g.tasks.length > 0),
    [tasks]
  );

  // Pre-compute per-member stats for each task on a past date (single pass per task)
  const otherDateStatsByTask = useMemo(() => {
    const map: Record<string, Record<string, { count: number; pts: number }>> = {};
    for (const c of otherDateCompletions) {
      if (!map[c.task_id]) map[c.task_id] = {};
      if (!map[c.task_id][c.member_id]) map[c.task_id][c.member_id] = { count: 0, pts: 0 };
      map[c.task_id][c.member_id].count += 1;
      map[c.task_id][c.member_id].pts += c.points_earned;
    }
    return map;
  }, [otherDateCompletions]);

  const fetchOtherDate = useCallback(async () => {
    if (isToday || !householdId) return;
    setLoadingOther(true);
    const { data } = await supabase
      .from('completions')
      .select('*')
      .eq('household_id', householdId)
      .gte('completed_at', selectedDayBounds.start.toISOString())
      .lte('completed_at', selectedDayBounds.end.toISOString());
    if (data) setOtherDateCompletions(data as Completion[]);
    setLoadingOther(false);
  }, [isToday, householdId, selectedDayBounds]);

  useEffect(() => {
    if (isToday) {
      setOtherDateCompletions([]);
    } else {
      fetchOtherDate();
    }
  }, [selectedDate, isToday, fetchOtherDate]);

  const handleQuickUndo = async (taskId: string, memberId: string) => {
    if (!householdId) return;
    const key = `undo-${taskId}-${memberId}`;
    setLoggingTask(prev => ({ ...prev, [key]: true }));

    try {
      const taskCompletions = getTaskCompletionsForDate(otherDateCompletions, taskId, selectedDate, memberId);
      const latest = taskCompletions.reduce<Completion | null>((currentLatest, completion) => {
        if (!currentLatest || completion.completed_at > currentLatest.completed_at) {
          return completion;
        }

        return currentLatest;
      }, null);

      if (!latest) {
        return;
      }

      await supabase.from('completions').delete().eq('id', latest.id);
      await Promise.all([fetchOtherDate(), refreshData()]);
    } finally {
      setLoggingTask(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleQuickLog = async (taskId: string, memberId: string) => {
    if (!householdId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const key = `${taskId}-${memberId}`;
    setLoggingTask(prev => ({ ...prev, [key]: true }));

    try {
      const existingCompletions = getTaskCompletionsForDate(otherDateCompletions, taskId, selectedDate, memberId);

      if (existingCompletions.length >= task.max_per_cycle) {
        return;
      }

      const completedAt = new Date(selectedDate);
      completedAt.setHours(12, 0, 0, 0);

      await supabase.from('completions').insert({
        task_id: taskId,
        household_id: householdId,
        member_id: memberId,
        points_earned: task.points,
        completed_at: completedAt.toISOString(),
      });

      await Promise.all([fetchOtherDate(), refreshData()]);
    } finally {
      setLoggingTask(prev => ({ ...prev, [key]: false }));
    }
  };

  const dateLabel = useMemo(() => {
    if (isToday) return 'Today';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (selectedDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return selectedDate.toLocaleDateString('en', { month: 'short', day: 'numeric', weekday: 'short' });
  }, [isToday, selectedDate]);

  // Today progress (earned pts / possible pts / completed task count)
  const todayProgress = useMemo(() => {
    if (!isToday || !currentMember) return { earned: 0, possible: 0, completedCount: 0, totalCount: tasks.length };
    const todayStart = getDayBounds(new Date()).start;
    let earned = 0;
    let completedCount = 0;
    let possible = 0;
    for (const task of tasks) {
      possible += task.max_per_cycle * task.points;
      const todayCompletions = completions.filter(
        c => c.member_id === currentMember.id && c.task_id === task.id && new Date(c.completed_at) >= todayStart
      );
      earned += todayCompletions.reduce((s, c) => s + c.points_earned, 0);
      if (todayCompletions.length > 0) completedCount++;
    }
    return { earned, possible, completedCount, totalCount: tasks.length };
  }, [isToday, currentMember, tasks, completions]);

  // Current streak (consecutive days with any completion, up to 90 days)
  const currentStreak = useMemo(
    () => (currentMember ? calculateStreak(completions, currentMember.id) : 0),
    [currentMember, completions],
  );

  // Mini achievements for the current member (only shown when isToday)
  const miniAchievements = useMemo(() => {
    if (!isToday || !currentMember) return [];
    const badges: { icon: string; label: string }[] = [];
    if (currentStreak >= 3) badges.push({ icon: '🔥', label: `${currentStreak}-Day Streak` });
    if (currentStreak >= 30) badges.push({ icon: '💎', label: 'Consistency King' });
    const dailyTasks = tasks.filter(t => t.frequency === 'daily');
    if (dailyTasks.length > 0) {
      const todayStart = getDayBounds(new Date()).start;
      const allDone = dailyTasks.every(task =>
        completions.some(c => c.member_id === currentMember.id && c.task_id === task.id && new Date(c.completed_at) >= todayStart)
      );
      if (allDone) badges.push({ icon: '🌟', label: 'Perfect Day' });
    }
    return badges;
  }, [isToday, currentMember, currentStreak, tasks, completions]);

  // Notification hooks
  const { enabled: notificationsEnabled } = useNotifications();
  const getRemainingCount = useCallback(() => {
    if (!currentMember) return 0;
    const todayStart = getDayBounds(new Date()).start;
    return tasks.filter(task => {
      const done = completions.filter(
        c => c.member_id === currentMember.id && c.task_id === task.id && new Date(c.completed_at) >= todayStart
      ).length;
      return done < task.max_per_cycle;
    }).length;
  }, [tasks, completions, currentMember]);
  useDailyReminder(isToday && notificationsEnabled, getRemainingCount);

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-foreground">
          {greeting()}, {currentMember?.display_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Tap a date to view or log completions</p>
      </motion.div>

      {/* Today Progress */}
      {isToday && (
        <>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-2xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Today's Progress</p>
              {currentStreak >= 2 && (
                <Badge variant="secondary" className="text-xs font-bold">
                  🔥 {currentStreak}-day streak
                </Badge>
              )}
            </div>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-extrabold text-primary">{todayProgress.earned}<span className="text-sm font-semibold text-muted-foreground ml-1">/ {todayProgress.possible} pts</span></p>
              <p className="text-xs text-muted-foreground">{todayProgress.completedCount}/{todayProgress.totalCount} tasks done</p>
            </div>
            <Progress value={todayProgress.possible > 0 ? (todayProgress.earned / todayProgress.possible) * 100 : 0} className="h-2" />
          </motion.div>

          {/* Mini achievements */}
          {miniAchievements.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex flex-wrap gap-2">
              {miniAchievements.map((a, i) => (
                <Badge key={i} variant="outline" className="text-xs font-semibold gap-1 px-2 py-1">
                  <span>{a.icon}</span> {a.label}
                </Badge>
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border overflow-hidden"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={day => { if (day) setSelectedDate(day); }}
          className="w-full"
          disabled={{ after: new Date() }}
          modifiers={{
            hasCompletions: (day) => {
              const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              return daysWithCompletions.has(key);
            },
          }}
          modifiersStyles={{
            hasCompletions: {
              fontWeight: 'bold',
              textDecoration: 'underline',
              textDecorationColor: members[0]?.avatar_color ?? '#0D9488',
              textUnderlineOffset: '3px',
            },
          }}
        />
      </motion.div>

      {/* Date header pill */}
      <motion.div
        key={selectedDate.toDateString()}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <span className="text-lg font-bold text-foreground">{dateLabel}</span>
        {!isToday && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Backfill mode</span>
        )}
      </motion.div>

      {/* Points mini-board */}
      <div className="grid grid-cols-2 gap-3">
        {dayPoints.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 border"
            style={{ backgroundColor: `${m.avatar_color}15` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-primary-foreground"
                style={{ backgroundColor: m.avatar_color }}
              >
                {m.display_name.charAt(0)}
              </div>
              <span className="text-sm font-semibold text-foreground truncate">{m.display_name.split(' ')[0]}</span>
            </div>
            <p className="text-3xl font-extrabold" style={{ color: m.avatar_color }}>{m.pts}</p>
            <p className="text-xs text-muted-foreground">pts {isToday ? 'today' : 'that day'}</p>
          </motion.div>
        ))}
      </div>

      {/* Task section */}
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-foreground">
          {isToday ? "Today's Tasks" : 'Tasks that day'}
        </h2>

        {tasks.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No tasks yet. Add some in the Tasks tab!</p>
        )}

        {loadingOther && !isToday && (
          <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
        )}

        {(!loadingOther || isToday) && groupedTasks.map((group, gi) => (
          <motion.div
            key={group.value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.04 }}
          >
            {/* Category header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{group.emoji}</span>
              <h3 className="font-semibold text-foreground text-sm">{group.label}</h3>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className={isToday ? "grid grid-cols-3 gap-2" : "space-y-2"}>
              {isToday
                ? group.tasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.04 + i * 0.04 }}
                    >
                      <TaskCard task={task} onComplete={refreshData} compact />
                    </motion.div>
                  ))
                : group.tasks.map((task, i) => {
                    const taskStats = otherDateStatsByTask[task.id] ?? {};
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.04 + i * 0.04 }}
                        className="bg-card rounded-2xl border p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-3xl flex-shrink-0">{task.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-foreground truncate">{task.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-sm font-semibold text-amber-600">{task.points} pts each</span>
                            </div>
                            {/* Who completed it — single-pass via pre-computed map */}
                            <div className="mt-2 space-y-0.5">
                              {members.map(m => {
                                const stat = taskStats[m.id];
                                if (!stat) return (
                                  <p key={m.id} className="text-xs text-muted-foreground">{m.display_name.split(' ')[0]}: none</p>
                                );
                                return (
                                  <p key={m.id} className="text-xs font-semibold" style={{ color: m.avatar_color }}>
                                    {m.display_name.split(' ')[0]} ×{stat.count} (+{stat.pts} pts)
                                  </p>
                                );
                              })}
                            </div>
                            {/* Quick log + undo buttons */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {members.map(m => {
                                const logKey = `${task.id}-${m.id}`;
                                const undoKey = `undo-${task.id}-${m.id}`;
                                const hasEntry = !!(taskStats[m.id]?.count);
                                return (
                                  <div key={m.id} className="flex gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7 px-3"
                                      disabled={loggingTask[logKey]}
                                      onClick={() => handleQuickLog(task.id, m.id)}
                                      style={{ borderColor: m.avatar_color, color: m.avatar_color }}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      {m.display_name.split(' ')[0]}
                                    </Button>
                                    {hasEntry && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        disabled={loggingTask[undoKey]}
                                        onClick={() => handleQuickUndo(task.id, m.id)}
                                        title={`Undo last ${m.display_name.split(' ')[0]} entry`}
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
              }
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TodayPage;

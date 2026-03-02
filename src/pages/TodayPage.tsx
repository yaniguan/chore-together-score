import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useHousehold, Completion } from '@/context/HouseholdContext';
import TaskCard from '@/components/TaskCard';
import { Calendar } from '@/components/ui/calendar';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Star, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  // Days that have any completions in the 90-day context window
  const daysWithCompletions = useMemo(() => {
    const s = new Set<string>();
    for (const c of completions) {
      const d = new Date(c.completed_at);
      s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return s;
  }, [completions]);

  // Points for selected date
  const startOfSelected = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const endOfSelected = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [selectedDate]);

  const dayPoints = useMemo(() => {
    if (isToday) {
      return members.map(m => ({
        ...m,
        pts: completions
          .filter(c => c.member_id === m.id && new Date(c.completed_at) >= startOfSelected)
          .reduce((s, c) => s + c.points_earned, 0),
      }));
    }
    return members.map(m => ({
      ...m,
      pts: otherDateCompletions
        .filter(c => c.member_id === m.id)
        .reduce((s, c) => s + c.points_earned, 0),
    }));
  }, [isToday, completions, otherDateCompletions, members, startOfSelected]);

  // Fetch completions for non-today dates
  const fetchOtherDate = useCallback(async () => {
    if (isToday || !householdId) return;
    setLoadingOther(true);
    const { data } = await supabase
      .from('completions')
      .select('*')
      .eq('household_id', householdId)
      .gte('completed_at', startOfSelected.toISOString())
      .lte('completed_at', endOfSelected.toISOString());
    if (data) setOtherDateCompletions(data as Completion[]);
    setLoadingOther(false);
  }, [isToday, householdId, startOfSelected, endOfSelected]);

  useEffect(() => {
    if (isToday) {
      setOtherDateCompletions([]);
    } else {
      fetchOtherDate();
    }
  }, [selectedDate, isToday, fetchOtherDate]);

  const handleQuickLog = async (taskId: string, memberId: string) => {
    if (!householdId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const key = `${taskId}-${memberId}`;
    setLoggingTask(prev => ({ ...prev, [key]: true }));

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
    setLoggingTask(prev => ({ ...prev, [key]: false }));
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

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-foreground">
          {greeting()}, {currentMember?.display_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Tap a date to view or log completions</p>
      </motion.div>

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
      {isToday ? (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Today's Tasks</h2>
          {tasks.map((task, i) => (
            <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <TaskCard task={task} onComplete={refreshData} />
            </motion.div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No tasks yet. Add some in the Tasks tab!</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Tasks that day</h2>
          {loadingOther ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
          ) : (
            tasks.map((task, i) => {
              const taskCompletions = otherDateCompletions.filter(c => c.task_id === task.id);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
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
                      {/* Who completed it */}
                      <div className="mt-2 space-y-0.5">
                        {members.map(m => {
                          const count = taskCompletions.filter(c => c.member_id === m.id).length;
                          const pts = taskCompletions.filter(c => c.member_id === m.id).reduce((s, c) => s + c.points_earned, 0);
                          if (count === 0) {
                            return (
                              <p key={m.id} className="text-xs text-muted-foreground">
                                {m.display_name.split(' ')[0]}: none
                              </p>
                            );
                          }
                          return (
                            <p key={m.id} className="text-xs font-semibold" style={{ color: m.avatar_color }}>
                              {m.display_name.split(' ')[0]} ×{count} (+{pts} pts)
                            </p>
                          );
                        })}
                      </div>
                      {/* Quick log buttons */}
                      <div className="flex gap-2 mt-3">
                        {members.map(m => {
                          const key = `${task.id}-${m.id}`;
                          return (
                            <Button
                              key={m.id}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-3"
                              disabled={loggingTask[key]}
                              onClick={() => handleQuickLog(task.id, m.id)}
                              style={{ borderColor: m.avatar_color, color: m.avatar_color }}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              {m.display_name.split(' ')[0]}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
          {tasks.length === 0 && !loadingOther && (
            <p className="text-center text-muted-foreground py-8">No tasks yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TodayPage;

import React, { useMemo } from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { Trophy, Flame, TrendingUp, Target } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { members, tasks, completions, currentMember } = useHousehold();
  const memberA = members[0];
  const memberB = members[1];

  // All-time & this week totals
  const totals = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    return members.map(m => {
      const allTime = completions.filter(c => c.member_id === m.id).reduce((s, c) => s + c.points_earned, 0);
      const thisWeek = completions.filter(c => c.member_id === m.id && new Date(c.completed_at) >= weekStart).reduce((s, c) => s + c.points_earned, 0);
      return { ...m, allTime, thisWeek };
    });
  }, [members, completions]);

  // Per-task breakdown
  const taskBreakdown = useMemo(() => {
    return tasks.map(task => {
      const data: any = { name: `${task.icon} ${task.name}` };
      members.forEach(m => {
        data[m.display_name] = completions.filter(c => c.task_id === task.id && c.member_id === m.id).reduce((s, c) => s + c.points_earned, 0);
      });
      return data;
    });
  }, [tasks, members, completions]);

  // Weekly trend (last 7 days)
  const weeklyTrend = useMemo(() => {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);

      const dayData: any = { day: date.toLocaleDateString('en', { weekday: 'short' }) };
      members.forEach(m => {
        dayData[m.display_name] = completions
          .filter(c => c.member_id === m.id && new Date(c.completed_at) >= date && new Date(c.completed_at) < nextDay)
          .reduce((s, c) => s + c.points_earned, 0);
      });
      days.push(dayData);
    }
    return days;
  }, [members, completions]);

  // Today's progress
  const todayProgress = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return members.map(m => {
      const completed = new Set(completions.filter(c => c.member_id === m.id && new Date(c.completed_at) >= today).map(c => c.task_id)).size;
      return { ...m, completed, total: tasks.length };
    });
  }, [members, completions, tasks]);

  // Achievements
  const achievements = useMemo(() => {
    const badges: { icon: string; label: string; member: string; color: string }[] = [];
    
    // Top scorer this week
    const weekScores = totals.sort((a, b) => b.thisWeek - a.thisWeek);
    if (weekScores[0]?.thisWeek > 0) {
      badges.push({ icon: '🏆', label: 'Top Scorer This Week', member: weekScores[0].display_name, color: weekScores[0].avatar_color });
    }

    // Check streaks (simplified - consecutive days)
    members.forEach(m => {
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const next = new Date(date);
        next.setDate(date.getDate() + 1);
        const hasCompletion = completions.some(c => c.member_id === m.id && new Date(c.completed_at) >= date && new Date(c.completed_at) < next);
        if (hasCompletion) streak++;
        else break;
      }
      if (streak >= 3) badges.push({ icon: '🔥', label: `${streak}-Day Streak`, member: m.display_name, color: m.avatar_color });
    });

    return badges;
  }, [members, completions, totals]);

  if (members.length < 2) return <p className="text-muted-foreground text-center py-8">Waiting for both members...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">Dashboard</h1>

      {/* Scoreboard */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
        {totals.map(m => (
          <div key={m.id} className="bg-card rounded-2xl border p-5 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-xl font-bold text-primary-foreground" style={{ backgroundColor: m.avatar_color }}>
              {m.display_name.charAt(0)}
            </div>
            <p className="font-bold text-foreground text-sm">{m.display_name}</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: m.avatar_color }}>{m.allTime}</p>
            <p className="text-xs text-muted-foreground">all time</p>
            <p className="text-lg font-bold mt-1" style={{ color: m.avatar_color }}>{m.thisWeek}</p>
            <p className="text-xs text-muted-foreground">this week</p>
          </div>
        ))}
      </motion.div>

      {/* Today's Progress */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-foreground">Today's Progress</h2>
        </div>
        <div className="space-y-3">
          {todayProgress.map(m => (
            <div key={m.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold" style={{ color: m.avatar_color }}>{m.display_name}</span>
                <span className="text-muted-foreground">{m.completed}/{m.total} tasks</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: m.total > 0 ? `${(m.completed / m.total) * 100}%` : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: m.avatar_color }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Weekly Trend */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-foreground">Weekly Trend</h2>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
            {members.map(m => (
              <Line key={m.id} type="monotone" dataKey={m.display_name} stroke={m.avatar_color} strokeWidth={3} dot={{ fill: m.avatar_color, r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Per-Task Breakdown */}
      {taskBreakdown.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Per-Task Breakdown</h2>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, taskBreakdown.length * 40)}>
            <BarChart data={taskBreakdown} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              {members.map(m => (
                <Bar key={m.id} dataKey={m.display_name} fill={m.avatar_color} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-foreground">Achievements</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {achievements.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-muted/50">
                <span className="text-lg">{badge.icon}</span>
                <div>
                  <p className="text-xs font-bold text-foreground">{badge.label}</p>
                  <p className="text-[10px]" style={{ color: badge.color }}>{badge.member}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardPage;

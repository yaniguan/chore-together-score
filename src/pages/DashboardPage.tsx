import React, { useMemo, useState, useEffect } from 'react';
import { useHousehold, Completion } from '@/context/HouseholdContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { Trophy, Flame, TrendingUp, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const DashboardPage: React.FC = () => {
  const { members, tasks, completions, allTimePoints, householdId } = useHousehold();
  const [periodTab, setPeriodTab] = useState<'30days' | 'monthly'>('30days');
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // ── Summary totals (this week + this month) ──────────────────────────────
  const totals = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return members.map(m => {
      const thisWeek = completions
        .filter(c => c.member_id === m.id && new Date(c.completed_at) >= weekStart)
        .reduce((s, c) => s + c.points_earned, 0);
      const thisMonth = completions
        .filter(c => c.member_id === m.id && new Date(c.completed_at) >= monthStart)
        .reduce((s, c) => s + c.points_earned, 0);
      return { ...m, thisWeek, thisMonth };
    });
  }, [members, completions]);

  // ── Past 30 days data ─────────────────────────────────────────────────────
  const past30Days = useMemo(() => {
    const days: any[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const entry: any = {
        label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      };
      members.forEach(m => {
        entry[m.display_name] = completions
          .filter(c => c.member_id === m.id && new Date(c.completed_at) >= d && new Date(c.completed_at) < next)
          .reduce((s, c) => s + c.points_earned, 0);
      });
      days.push(entry);
    }
    return days;
  }, [completions, members]);

  // ── Cumulative race ───────────────────────────────────────────────────────
  const cumulativeData = useMemo(() => {
    const running: Record<string, number> = {};
    members.forEach(m => (running[m.display_name] = 0));
    return past30Days.map(day => {
      const entry: any = { label: day.label };
      members.forEach(m => {
        running[m.display_name] += day[m.display_name] ?? 0;
        entry[m.display_name] = running[m.display_name];
      });
      return entry;
    });
  }, [past30Days, members]);

  // ── Daily gap ─────────────────────────────────────────────────────────────
  const dailyGap = useMemo(() => {
    const [a, b] = members;
    if (!a || !b) return [];
    return past30Days.map(day => {
      const gap = (day[a.display_name] ?? 0) - (day[b.display_name] ?? 0);
      return { label: day.label, gap, positive: gap >= 0 };
    });
  }, [past30Days, members]);

  // ── Monthly data (fetched from Supabase) ──────────────────────────────────
  useEffect(() => {
    if (periodTab !== 'monthly' || !householdId) return;
    setLoadingMonthly(true);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    supabase
      .from('completions')
      .select('member_id, points_earned, completed_at')
      .eq('household_id', householdId)
      .gte('completed_at', twelveMonthsAgo.toISOString())
      .then(({ data }) => {
        if (!data) { setLoadingMonthly(false); return; }
        // Group by YYYY-MM
        const grouped: Record<string, Record<string, number>> = {};
        for (const c of data as Completion[]) {
          const d = new Date(c.completed_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!grouped[key]) grouped[key] = {};
          const member = members.find(m => m.id === c.member_id);
          if (!member) continue;
          grouped[key][member.display_name] = (grouped[key][member.display_name] ?? 0) + c.points_earned;
        }
        // Build sorted array for past 12 months
        const result: any[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
          const entry: any = { label };
          members.forEach(m => {
            entry[m.display_name] = grouped[key]?.[m.display_name] ?? 0;
          });
          result.push(entry);
        }
        setMonthlyData(result);
        setLoadingMonthly(false);
      });
  }, [periodTab, householdId, members]);

  // ── Per-task breakdown ────────────────────────────────────────────────────
  const taskBreakdown = useMemo(() => {
    return tasks.map(task => {
      const data: any = { name: `${task.icon} ${task.name}` };
      members.forEach(m => {
        data[m.display_name] = completions
          .filter(c => c.task_id === task.id && c.member_id === m.id)
          .reduce((s, c) => s + c.points_earned, 0);
      });
      return data;
    });
  }, [tasks, members, completions]);

  // ── Achievements ──────────────────────────────────────────────────────────
  const achievements = useMemo(() => {
    const badges: { icon: string; label: string; member: string; color: string }[] = [];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekScores = members
      .map(m => ({ ...m, score: completions.filter(c => c.member_id === m.id && new Date(c.completed_at) >= weekStart).reduce((s, c) => s + c.points_earned, 0) }))
      .sort((a, b) => b.score - a.score);
    if (weekScores[0]?.score > 0) {
      badges.push({ icon: '🏆', label: 'Top Scorer This Week', member: weekScores[0].display_name, color: weekScores[0].avatar_color });
    }

    members.forEach(m => {
      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const next = new Date(date);
        next.setDate(date.getDate() + 1);
        if (completions.some(c => c.member_id === m.id && new Date(c.completed_at) >= date && new Date(c.completed_at) < next)) streak++;
        else break;
      }
      if (streak >= 3) badges.push({ icon: '🔥', label: `${streak}-Day Streak`, member: m.display_name, color: m.avatar_color });
    });

    return badges;
  }, [members, completions]);

  const tooltipStyle = { borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };

  if (members.length < 2) return <p className="text-muted-foreground text-center py-8">Waiting for both members...</p>;

  const [memberA, memberB] = members;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">Dashboard</h1>

      {/* ── A. Summary Scorecards ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
        {/* This Week */}
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground font-semibold mb-3">This Week</p>
          <div className="space-y-2">
            {totals.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-primary-foreground flex-shrink-0" style={{ backgroundColor: m.avatar_color }}>
                  {m.display_name.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-foreground truncate flex-1">{m.display_name.split(' ')[0]}</span>
                <span className="text-sm font-extrabold" style={{ color: m.avatar_color }}>{m.thisWeek}</span>
                <span className="text-[10px] text-muted-foreground">pts</span>
              </div>
            ))}
          </div>
        </div>
        {/* This Month */}
        <div className="bg-card rounded-2xl border p-4">
          <p className="text-xs text-muted-foreground font-semibold mb-3">This Month</p>
          <div className="space-y-2">
            {totals.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-primary-foreground flex-shrink-0" style={{ backgroundColor: m.avatar_color }}>
                  {m.display_name.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-foreground truncate flex-1">{m.display_name.split(' ')[0]}</span>
                <span className="text-sm font-extrabold" style={{ color: m.avatar_color }}>{m.thisMonth}</span>
                <span className="text-[10px] text-muted-foreground">pts</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── B. Period View ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Points Over Time</h2>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setPeriodTab('30days')}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${periodTab === '30days' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              30 Days
            </button>
            <button
              onClick={() => setPeriodTab('monthly')}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${periodTab === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              By Month
            </button>
          </div>
        </div>

        {periodTab === '30days' ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={past30Days} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                interval={4}
                angle={-30}
                textAnchor="end"
                height={36}
              />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {members.map(m => (
                <Bar key={m.id} dataKey={m.display_name} fill={m.avatar_color} radius={[2, 2, 0, 0]} maxBarSize={14} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : loadingMonthly ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {members.map(m => (
                <Bar key={m.id} dataKey={m.display_name} fill={m.avatar_color} radius={[2, 2, 0, 0]} maxBarSize={24} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── C. Cumulative Race ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-foreground">Cumulative Race (30 Days)</h2>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={cumulativeData} margin={{ left: -20, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              interval={4}
              angle={-30}
              textAnchor="end"
              height={36}
            />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {members.map(m => (
              <Line
                key={m.id}
                type="monotone"
                dataKey={m.display_name}
                stroke={m.avatar_color}
                strokeWidth={2.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── D. Daily Gap ── */}
      {memberA && memberB && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Daily Edge</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            <span style={{ color: memberA.avatar_color }}>{memberA.display_name.split(' ')[0]}</span>
            {' '}&minus;{' '}
            <span style={{ color: memberB.avatar_color }}>{memberB.display_name.split(' ')[0]}</span>
            {' '}per day (30 days)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dailyGap} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                interval={4}
                angle={-30}
                textAnchor="end"
                height={36}
              />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [`${value > 0 ? '+' : ''}${value} pts`, `${memberA.display_name.split(' ')[0]} lead`]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
              <Bar dataKey="gap" radius={[2, 2, 0, 0]} maxBarSize={14}>
                {dailyGap.map((entry, i) => (
                  <Cell key={i} fill={entry.positive ? memberA.avatar_color : memberB.avatar_color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* ── E. Per-Task Breakdown ── */}
      {taskBreakdown.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Per-Task Breakdown</h2>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, taskBreakdown.length * 40)}>
            <BarChart data={taskBreakdown} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              {members.map(m => (
                <Bar key={m.id} dataKey={m.display_name} fill={m.avatar_color} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* ── Achievements ── */}
      {achievements.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-2xl border p-5">
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

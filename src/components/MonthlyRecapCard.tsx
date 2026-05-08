import React, { useMemo, useState } from 'react';
import { useHousehold, Completion } from '@/context/HouseholdContext';
import { motion } from 'framer-motion';
import { Trophy, Sparkles, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { getMonthKey, getMonthRange, formatMonthLabel } from '@/lib/monthCycle';

// "Recap" = a friendly summary of one month: winner, totals, top tasks, photo
// count. Sourced from monthlyScores (frozen archive) plus completions (last
// 90 days are in context — older months gracefully degrade to scores only).
const MonthlyRecapCard: React.FC = () => {
  const { members, tasks, completions, monthlyScores, monthEarned, monthSpent, redemptions } = useHousehold();

  // Pickable months: current + everything in monthlyScores. Sort desc.
  const availableMonths = useMemo(() => {
    const keys = new Set<string>([getMonthKey(new Date())]);
    for (const row of monthlyScores) keys.add(row.year_month);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [monthlyScores]);

  const [selected, setSelected] = useState<string>(() => availableMonths[0] ?? getMonthKey(new Date()));
  // Keep selection valid if availableMonths changes
  const safeSelected = availableMonths.includes(selected) ? selected : (availableMonths[0] ?? getMonthKey(new Date()));
  const idx = availableMonths.indexOf(safeSelected);
  const isCurrent = safeSelected === getMonthKey(new Date());

  const range = useMemo(() => {
    const [y, m] = safeSelected.split('-').map(Number);
    return getMonthRange(new Date(y, m - 1, 1));
  }, [safeSelected]);

  // Per-member earned/spent for selected month — current uses live state,
  // past uses archived rows.
  const memberSummary = useMemo(() => {
    if (isCurrent) {
      return members.map(m => ({
        ...m,
        earned: monthEarned[m.id] ?? 0,
        spent: monthSpent[m.id] ?? 0,
      }));
    }
    return members.map(m => {
      const archived = monthlyScores.find(r => r.year_month === safeSelected && r.member_id === m.id);
      return {
        ...m,
        earned: archived?.points_earned ?? 0,
        spent: archived?.points_spent ?? 0,
      };
    });
  }, [isCurrent, members, monthEarned, monthSpent, monthlyScores, safeSelected]);

  // Completions for selected month (only available if within last ~90 days
  // window of context).
  const monthCompletions = useMemo<Completion[]>(() => {
    return completions.filter(c => {
      const t = new Date(c.completed_at);
      return t >= range.start && t < range.end;
    });
  }, [completions, range]);

  // Top tasks per member by completion count (only meaningful when monthCompletions has data)
  const topTaskByMember = useMemo(() => {
    const out: Record<string, { taskId: string; count: number; pts: number } | null> = {};
    for (const m of members) {
      const counts: Record<string, { count: number; pts: number }> = {};
      for (const c of monthCompletions) {
        if (c.member_id !== m.id) continue;
        if (!counts[c.task_id]) counts[c.task_id] = { count: 0, pts: 0 };
        counts[c.task_id].count += 1;
        counts[c.task_id].pts += c.points_earned;
      }
      const ranked = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
      out[m.id] = ranked[0] ? { taskId: ranked[0][0], count: ranked[0][1].count, pts: ranked[0][1].pts } : null;
    }
    return out;
  }, [monthCompletions, members]);

  const totalCompletions = monthCompletions.length;
  const totalPhotos = monthCompletions.filter(c => c.photo_url).length;

  const monthRedemptions = redemptions.filter(r => {
    const t = new Date(r.redeemed_at);
    return t >= range.start && t < range.end;
  });

  // Winner: highest earned, only when there are at least 2 members and earned > 0
  const sorted = [...memberSummary].sort((a, b) => b.earned - a.earned);
  const winner = sorted.length >= 2 && sorted[0].earned > sorted[1].earned ? sorted[0] : null;
  const tied = sorted.length >= 2 && sorted[0].earned === sorted[1].earned && sorted[0].earned > 0;

  const findTaskName = (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    return t ? `${t.icon} ${t.name}` : '—';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-foreground flex-1">月度复盘</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelected(availableMonths[idx + 1] ?? safeSelected)}
            disabled={idx >= availableMonths.length - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
            aria-label="上个月"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-foreground min-w-[72px] text-center">
            {formatMonthLabel(safeSelected)}
          </span>
          <button
            onClick={() => setSelected(availableMonths[idx - 1] ?? safeSelected)}
            disabled={idx <= 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
            aria-label="下个月"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Headline */}
      {tied ? (
        <div className="rounded-xl bg-muted/50 p-4 text-center">
          <p className="text-2xl">🤝</p>
          <p className="text-sm font-bold text-foreground mt-1">这个月打成平手</p>
          <p className="text-xs text-muted-foreground">两人各拿 {sorted[0].earned} 分</p>
        </div>
      ) : winner ? (
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${winner.avatar_color}15` }}>
          <Trophy className="w-8 h-8 mx-auto" style={{ color: winner.avatar_color }} />
          <p className="text-sm font-bold text-foreground mt-1">
            {isCurrent ? '本月领先' : '本月赢家'}: <span style={{ color: winner.avatar_color }}>{winner.display_name.split(' ')[0]}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            领先 {sorted[0].earned - sorted[1].earned} 分 · 共 {sorted[0].earned} 分
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-muted/50 p-4 text-center text-muted-foreground text-sm">
          这个月还没有数据
        </div>
      )}

      {/* Per-member breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {memberSummary.map(m => {
          const top = topTaskByMember[m.id];
          return (
            <div key={m.id} className="rounded-xl border p-3 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center text-primary-foreground" style={{ backgroundColor: m.avatar_color }}>
                  {m.display_name.charAt(0)}
                </div>
                <span className="text-xs font-bold text-foreground truncate">{m.display_name.split(' ')[0]}</span>
              </div>
              <p className="text-xl font-extrabold" style={{ color: m.avatar_color }}>{m.earned}<span className="text-xs font-semibold text-muted-foreground ml-1">分</span></p>
              {m.spent > 0 && <p className="text-[10px] text-destructive">-{m.spent} 已兑换</p>}
              {top ? (
                <p className="text-[10px] text-muted-foreground truncate">最爱: {findTaskName(top.taskId)} ×{top.count}</p>
              ) : monthCompletions.length === 0 && !isCurrent ? (
                <p className="text-[10px] text-muted-foreground/70">详情已超出 90 天窗口</p>
              ) : (
                <p className="text-[10px] text-muted-foreground/70">还没记录</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-around text-xs text-muted-foreground border-t pt-3">
        <div className="text-center">
          <p className="font-extrabold text-foreground text-base">{totalCompletions || '—'}</p>
          <p>完成次数</p>
        </div>
        <div className="text-center">
          <p className="font-extrabold text-foreground text-base flex items-center justify-center gap-1">
            <Camera className="w-3 h-3" /> {totalPhotos}
          </p>
          <p>打卡照片</p>
        </div>
        <div className="text-center">
          <p className="font-extrabold text-foreground text-base">{monthRedemptions.length}</p>
          <p>兑换奖励</p>
        </div>
      </div>
      {!isCurrent && totalCompletions === 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          *该月任务明细已超出 90 天数据窗口，仅显示积分汇总
        </p>
      )}
      <p className="text-[10px] text-muted-foreground text-center">截图保存即可分享 📸</p>
    </motion.div>
  );
};

export default MonthlyRecapCard;

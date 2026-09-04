import React, { useMemo, useState } from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import MonthDuelCard from '@/components/MonthDuelCard';
import { getMonthKey, getMonthRange, formatMonthLabel } from '@/lib/monthCycle';
import { CATEGORIES, normalizeCategory } from '@/lib/constants';
import { TaskIcon } from '@/lib/taskIcons';
import { ChevronLeft, ChevronRight, UtensilsCrossed, Camera } from 'lucide-react';

/** Replaces the old Dashboard: one screen that answers "who owes dinner". */
const MonthPage: React.FC = () => {
  const { members, tasks, completions, monthlyScores, monthEarned, redemptions } = useHousehold();

  const currentKey = getMonthKey(new Date());
  const availableMonths = useMemo(() => {
    const keys = new Set<string>([currentKey]);
    for (const row of monthlyScores) keys.add(row.year_month);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [monthlyScores, currentKey]);

  const [selected, setSelected] = useState(currentKey);
  const safeSelected = availableMonths.includes(selected) ? selected : currentKey;
  const idx = availableMonths.indexOf(safeSelected);
  const isCurrent = safeSelected === currentKey;

  const range = useMemo(() => {
    const [y, m] = safeSelected.split('-').map(Number);
    return getMonthRange(new Date(y, m - 1, 1));
  }, [safeSelected]);

  // Completions inside the selected month (context holds ~90 days; older
  // months fall back to the archived totals only).
  const monthCompletions = useMemo(
    () => completions.filter(c => {
      const t = new Date(c.completed_at);
      return t >= range.start && t < range.end;
    }),
    [completions, range],
  );

  const scores = useMemo(() => {
    if (isCurrent) return members.map(m => ({ ...m, pts: monthEarned[m.id] ?? 0 }));
    return members.map(m => ({
      ...m,
      pts: monthlyScores.find(r => r.year_month === safeSelected && r.member_id === m.id)?.points_earned ?? 0,
    }));
  }, [isCurrent, members, monthEarned, monthlyScores, safeSelected]);

  // ── Daily bars ───────────────────────────────────────────────────────────
  const dailyBars = useMemo(() => {
    const dayCount = new Date(range.end.getTime() - 1).getDate();
    const bars = Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      byMember: {} as Record<string, number>,
    }));
    for (const c of monthCompletions) {
      const d = new Date(c.completed_at);
      const bar = bars[d.getDate() - 1];
      if (bar) bar.byMember[c.member_id] = (bar.byMember[c.member_id] ?? 0) + c.points_earned;
    }
    const max = Math.max(1, ...bars.map(b => Object.values(b.byMember).reduce((s, v) => s + v, 0)));
    return { bars, max };
  }, [monthCompletions, range]);

  // ── Per-area split ───────────────────────────────────────────────────────
  const areaSplit = useMemo(() => {
    const taskCategory = new Map(tasks.map(t => [t.id, normalizeCategory(t.category)]));
    const totals: Record<string, Record<string, number>> = {};
    for (const c of monthCompletions) {
      const cat = taskCategory.get(c.task_id);
      if (!cat) continue;
      if (!totals[cat]) totals[cat] = {};
      totals[cat][c.member_id] = (totals[cat][c.member_id] ?? 0) + c.points_earned;
    }
    return CATEGORIES
      .map(cat => ({
        ...cat,
        byMember: totals[cat.value] ?? {},
        total: Object.values(totals[cat.value] ?? {}).reduce((s, v) => s + v, 0),
      }))
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [monthCompletions, tasks]);

  // ── Top task per person ──────────────────────────────────────────────────
  const topTasks = useMemo(() => {
    const taskName = new Map(tasks.map(t => [t.id, t]));
    return members.map(m => {
      const counts: Record<string, number> = {};
      for (const c of monthCompletions) {
        if (c.member_id !== m.id) continue;
        counts[c.task_id] = (counts[c.task_id] ?? 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return { ...m, task: top ? taskName.get(top[0]) : undefined, count: top?.[1] ?? 0 };
    });
  }, [members, monthCompletions, tasks]);

  const totalCompletions = monthCompletions.length;
  const totalPhotos = monthCompletions.filter(c => c.photo_url).length;
  const monthRedemptions = useMemo(
    () => redemptions.filter(r => {
      const t = new Date(r.redeemed_at);
      return t >= range.start && t < range.end;
    }),
    [redemptions, range],
  );

  const sortedScores = [...scores].sort((a, b) => b.pts - a.pts);
  const [winner, loser] = sortedScores;
  const settled = !isCurrent && winner && loser && winner.pts !== loser.pts;

  return (
    <div className="space-y-5">
      {/* Month picker */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelected(availableMonths[idx + 1])}
          disabled={idx >= availableMonths.length - 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-25"
          aria-label="上个月"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">{formatMonthLabel(safeSelected)}</h1>
        <button
          onClick={() => setSelected(availableMonths[idx - 1])}
          disabled={idx <= 0}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-25"
          aria-label="下个月"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isCurrent ? (
        <MonthDuelCard />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="p-5 flex items-end justify-between gap-3">
            {scores.map(m => (
              <div key={m.id} className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.avatar_color }} />
                  <span className="text-xs text-muted-foreground truncate">{m.display_name.split(' ')[0]}</span>
                </div>
                <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: m.avatar_color }}>{m.pts}</p>
              </div>
            ))}
          </div>
          <div className="bg-muted/50 border-t px-4 py-2.5 flex items-center gap-2">
            <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
            <p className="text-xs text-muted-foreground">
              {settled ? (
                <>
                  <span className="font-semibold" style={{ color: winner.avatar_color }}>{winner.display_name.split(' ')[0]}</span>
                  {' '}赢了 · <span className="font-semibold" style={{ color: loser.avatar_color }}>{loser.display_name.split(' ')[0]}</span> 请客
                </>
              ) : '这个月平手，各付各的'}
            </p>
          </div>
        </div>
      )}

      {/* Daily bars */}
      {totalCompletions > 0 && (
        <div className="rounded-xl border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">每天得分</p>
          <div className="flex items-end gap-[2px] h-20">
            {dailyBars.bars.map(bar => {
              const total = Object.values(bar.byMember).reduce((s, v) => s + v, 0);
              return (
                <div
                  key={bar.day}
                  className="flex-1 flex flex-col justify-end gap-[1px] min-w-0"
                  title={`${bar.day} 日 · ${total} 分`}
                >
                  {members.map(m => {
                    const v = bar.byMember[m.id] ?? 0;
                    if (!v) return null;
                    return (
                      <div
                        key={m.id}
                        className="rounded-[1px]"
                        style={{ height: `${(v / dailyBars.max) * 100}%`, backgroundColor: m.avatar_color }}
                      />
                    );
                  })}
                  {total === 0 && <div className="h-[2px] rounded-[1px] bg-muted" />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>1</span>
            <span>{dailyBars.bars.length}</span>
          </div>
        </div>
      )}

      {/* Summary numbers */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '完成次数', value: totalCompletions },
          { label: '照片', value: totalPhotos, icon: true },
          { label: '兑换', value: monthRedemptions.length },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-3">
            <p className="text-xl font-bold tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              {s.icon && <Camera className="w-3 h-3" strokeWidth={1.75} />}
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Per-area split */}
      {areaSplit.length > 0 && (
        <div className="rounded-xl border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">各区域分工</p>
          <div className="space-y-3">
            {areaSplit.map(area => (
              <div key={area.value}>
                <div className="flex items-center gap-2 mb-1.5">
                  <TaskIcon name={area.icon} className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium flex-1">{area.label}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{area.total} 分</span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                  {members.map(m => {
                    const v = area.byMember[m.id] ?? 0;
                    if (!v) return null;
                    return (
                      <div
                        key={m.id}
                        style={{ width: `${(v / area.total) * 100}%`, backgroundColor: m.avatar_color }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top task per person */}
      {topTasks.some(t => t.task) && (
        <div className="rounded-xl border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">干得最多的</p>
          <div className="space-y-2.5">
            {topTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.avatar_color }} />
                <span className="text-xs text-muted-foreground w-14 truncate">{t.display_name.split(' ')[0]}</span>
                {t.task ? (
                  <>
                    <TaskIcon name={t.task.icon} className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium flex-1 truncate">{t.task.name}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">×{t.count}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground flex-1">这个月还没记录</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isCurrent && totalCompletions === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          超过 90 天的月份只保留总分，明细已归档
        </p>
      )}
    </div>
  );
};

export default MonthPage;

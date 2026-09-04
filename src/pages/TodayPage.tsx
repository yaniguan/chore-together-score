import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useHousehold, Completion, Task } from '@/context/HouseholdContext';
import TaskRow from '@/components/TaskRow';
import PhotoLightbox from '@/components/PhotoLightbox';
import MonthDuelCard from '@/components/MonthDuelCard';
import { supabase } from '@/integrations/supabase/client';
import { Flame, GripVertical, Check } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { CATEGORIES, FREQUENCIES, normalizeCategory, normalizeFrequency, FrequencyValue } from '@/lib/constants';
import { TaskIcon } from '@/lib/taskIcons';
import { getDayBounds, calculateStreak } from '@/lib/completions';
import { useNotifications } from '@/hooks/useNotifications';
import { useDailyReminder } from '@/hooks/useDailyReminder';

type Filter = FrequencyValue | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  ...FREQUENCIES.map(f => ({ value: f.value as Filter, label: f.label })),
  { value: 'all', label: '全部' },
];

const TodayPage: React.FC = () => {
  const { tasks, completions, currentMember, members, householdId, loadError, reorderTasks } = useHousehold();
  const [filter, setFilter] = useState<Filter>('daily');
  const [selectedOffset, setSelectedOffset] = useState(0); // 0 = today, 1 = yesterday …
  const [pastCompletions, setPastCompletions] = useState<Completion[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState(false);
  const [filterBeforeSort, setFilterBeforeSort] = useState<Filter>('daily');
  const [draftOrder, setDraftOrder] = useState<Record<string, Task[]>>({});

  const isToday = selectedOffset === 0;

  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - selectedOffset);
    return d;
  }, [selectedOffset]);

  // ── Last 7 days strip ────────────────────────────────────────────────────
  const dayStrip = useMemo(() => {
    const byDay = new Map<string, Set<string>>();
    for (const c of completions) {
      const d = new Date(c.completed_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, new Set());
      byDay.get(key)!.add(c.member_id);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const offset = 6 - i;
      const d = new Date();
      d.setDate(d.getDate() - offset);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      return {
        offset,
        date: d,
        weekday: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        dayOfMonth: d.getDate(),
        actors: byDay.get(key) ?? new Set<string>(),
      };
    });
  }, [completions]);

  // ── Today's progress — daily tasks only, so the bar can actually reach 100% ──
  const todayProgress = useMemo(() => {
    const dailyTasks = tasks.filter(t => normalizeFrequency(t.frequency) === 'daily');
    const { start, end } = getDayBounds(new Date());
    let earned = 0;
    let possible = 0;
    let doneCount = 0;

    for (const task of dailyTasks) {
      possible += task.max_per_cycle * task.points;
      const todays = completions.filter(c => {
        if (c.task_id !== task.id) return false;
        const at = new Date(c.completed_at);
        return at >= start && at <= end;
      });
      earned += todays.reduce((s, c) => s + c.points_earned, 0);
      if (todays.length > 0) doneCount++;
    }
    return { earned, possible, doneCount, total: dailyTasks.length };
  }, [tasks, completions]);

  const currentStreak = useMemo(
    () => (currentMember ? calculateStreak(completions, currentMember.id) : 0),
    [currentMember, completions],
  );

  // ── Task grouping ────────────────────────────────────────────────────────
  const groupedTasks = useMemo(() => {
    const visible = filter === 'all'
      ? tasks
      : tasks.filter(t => normalizeFrequency(t.frequency) === filter);
    return CATEGORIES
      .map(cat => ({ ...cat, tasks: visible.filter(t => normalizeCategory(t.category) === cat.value) }))
      .filter(g => g.tasks.length > 0);
  }, [tasks, filter]);

  // ── Past-day fetch (read-only) ───────────────────────────────────────────
  const fetchPast = useCallback(async () => {
    if (isToday || !householdId) return;
    setLoadingPast(true);
    const { start, end } = getDayBounds(selectedDate);
    const { data } = await supabase
      .from('completions')
      .select('*')
      .eq('household_id', householdId)
      .gte('completed_at', start.toISOString())
      .lte('completed_at', end.toISOString());
    setPastCompletions((data as Completion[]) ?? []);
    setLoadingPast(false);
  }, [isToday, householdId, selectedDate]);

  useEffect(() => {
    if (isToday) setPastCompletions([]);
    else fetchPast();
  }, [isToday, fetchPast]);

  // Group a past day's completions by task for the read-only summary.
  const pastByTask = useMemo(() => {
    const map = new Map<string, { count: number; pts: number; byMember: Record<string, number>; photos: string[] }>();
    for (const c of pastCompletions) {
      if (!map.has(c.task_id)) map.set(c.task_id, { count: 0, pts: 0, byMember: {}, photos: [] });
      const entry = map.get(c.task_id)!;
      entry.count += 1;
      entry.pts += c.points_earned;
      entry.byMember[c.member_id] = (entry.byMember[c.member_id] ?? 0) + 1;
      if (c.photo_url) entry.photos.push(c.photo_url);
    }
    return map;
  }, [pastCompletions]);

  const pastDayPoints = useMemo(
    () => members.map(m => ({
      ...m,
      pts: pastCompletions.filter(c => c.member_id === m.id).reduce((s, c) => s + c.points_earned, 0),
    })),
    [members, pastCompletions],
  );

  // ── Notifications ────────────────────────────────────────────────────────
  const { enabled: notificationsEnabled } = useNotifications();
  const getRemainingCount = useCallback(() => {
    const { start, end } = getDayBounds(new Date());
    return tasks.filter(task => {
      if (normalizeFrequency(task.frequency) !== 'daily') return false;
      const doneToday = completions.filter(c => {
        if (c.task_id !== task.id) return false;
        const at = new Date(c.completed_at);
        return at >= start && at <= end;
      }).length;
      return doneToday < task.max_per_cycle;
    }).length;
  }, [tasks, completions]);
  useDailyReminder(notificationsEnabled, getRemainingCount);

  // Reordering a filtered subset is a lie — you'd be dropping a row above one
  // you can't see. Entering sort mode therefore shows the whole list.
  const enterSortMode = () => {
    setFilterBeforeSort(filter);
    setFilter('all');
    setSortMode(true);
  };

  const exitSortMode = () => {
    setFilter(filterBeforeSort);
    setDraftOrder({});
    setSortMode(false);
  };

  // onReorder fires continuously while a row is being dragged, so the live
  // order is held locally and only written once, on drop.
  const orderFor = (category: string, groupTasks: Task[]) => draftOrder[category] ?? groupTasks;

  const handleReorder = (category: string, next: Task[]) => {
    setDraftOrder(prev => ({ ...prev, [category]: next }));
  };

  const commitOrder = async (category: string) => {
    const pending = draftOrder[category];
    if (!pending) return;
    await reorderTasks(pending.map(t => t.id));
    // Clear either way: on success the context already matches, on failure it
    // has rolled back and the draft would be showing a lie.
    setDraftOrder(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const progressPct = todayProgress.possible > 0
    ? Math.min(100, (todayProgress.earned / todayProgress.possible) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {currentMember?.display_name?.split(' ')[0]}，今天
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        {currentStreak >= 2 && (
          <div className="flex items-center gap-1 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-orange-500" strokeWidth={2} />
            <span>{currentStreak} 天</span>
          </div>
        )}
      </div>

      <MonthDuelCard compact />

      {/* Today's progress */}
      <div className="rounded-xl border p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground">今日进度</p>
          <p className="text-xs text-muted-foreground">
            每天任务 {todayProgress.doneCount}/{todayProgress.total}
          </p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">{todayProgress.earned}</span>
          <span className="text-xs text-muted-foreground">/ {todayProgress.possible} 分</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2.5">
          <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* 7-day strip */}
      <div className="flex gap-1.5">
        {dayStrip.map(d => {
          const active = d.offset === selectedOffset;
          return (
            <button
              key={d.offset}
              onClick={() => setSelectedOffset(d.offset)}
              className={`flex-1 rounded-lg border py-2 flex flex-col items-center gap-1 transition-colors ${
                active ? 'border-foreground bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              <span className="text-[10px] text-muted-foreground">{d.weekday}</span>
              <span className={`text-xs tabular-nums ${active ? 'font-bold' : ''}`}>{d.dayOfMonth}</span>
              <span className="flex gap-0.5 h-1">
                {members.map(m => (
                  <span
                    key={m.id}
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: d.actors.has(m.id) ? m.avatar_color : 'transparent' }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {isToday ? (
        <>
          {/* Frequency filter + reorder toggle */}
          {sortMode ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
              <p className="text-xs text-muted-foreground flex-1">拖动任务调整顺序，可在同一区域内移动</p>
              <button
                onClick={exitSortMode}
                className="text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-md bg-foreground text-background"
              >
                <Check className="w-3 h-3" strokeWidth={2.5} /> 完成
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1 p-0.5 rounded-lg bg-muted flex-1">
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                      filter === f.value ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={enterSortMode}
                disabled={tasks.length === 0}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-muted disabled:opacity-40 flex-shrink-0"
                title="调整任务顺序"
              >
                <GripVertical className="w-3.5 h-3.5" strokeWidth={1.75} /> 排序
              </button>
            </div>
          )}

          {tasks.length === 0 ? (
            /* Never claim the list is empty when we simply failed to load it. */
            loadError ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                任务没能加载出来，请用上方的「重试」再试一次。
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-10">
                还没有任务。到「设置 → 管理任务」添加，或一键载入默认清单。
              </p>
            )
          ) : groupedTasks.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">这个频率下没有任务</p>
          ) : (
            groupedTasks.map(group => (
              <div key={group.value}>
                <div className="flex items-center gap-2 mb-1">
                  <TaskIcon name={group.icon} className="w-3.5 h-3.5" />
                  <h2 className="text-xs font-semibold text-muted-foreground">{group.label}</h2>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {sortMode ? (
                  <Reorder.Group
                    axis="y"
                    values={orderFor(group.value, group.tasks)}
                    onReorder={next => handleReorder(group.value, next)}
                    className="divide-y"
                  >
                    {orderFor(group.value, group.tasks).map(task => (
                      <Reorder.Item
                        key={task.id}
                        value={task}
                        style={{ touchAction: 'none' }}
                        whileDrag={{ scale: 1.02, zIndex: 10 }}
                        onDragEnd={() => { void commitOrder(group.value); }}
                        className="bg-background cursor-grab active:cursor-grabbing"
                      >
                        <TaskRow task={task} sortMode />
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                ) : (
                  <div className="divide-y">
                    {group.tasks.map(task => <TaskRow key={task.id} task={task} />)}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      ) : (
        /* ── Past day: read-only ── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            </p>
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">仅可查看</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {pastDayPoints.map(m => (
              <div key={m.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.avatar_color }} />
                  <span className="text-xs text-muted-foreground truncate">{m.display_name.split(' ')[0]}</span>
                </div>
                <p className="text-xl font-bold tabular-nums" style={{ color: m.avatar_color }}>{m.pts}</p>
              </div>
            ))}
          </div>

          {loadingPast ? (
            <p className="text-center text-sm text-muted-foreground py-8">加载中…</p>
          ) : pastByTask.size === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">这天没有记录</p>
          ) : (
            <div className="divide-y">
              {tasks.filter(t => pastByTask.has(t.id)).map(task => {
                const entry = pastByTask.get(task.id)!;
                return (
                  <div key={task.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                      <TaskIcon name={task.icon} className="w-[18px] h-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.name}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        <span>+{entry.pts} 分</span>
                        {members.map(m => {
                          const count = entry.byMember[m.id];
                          if (!count) return null;
                          return (
                            <span key={m.id} className="flex items-center gap-0.5 font-medium" style={{ color: m.avatar_color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.avatar_color }} />
                              {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {entry.photos.slice(0, 3).map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setPreviewPhoto(url)}
                        className="w-8 h-8 rounded-lg overflow-hidden border flex-shrink-0"
                        title="查看照片"
                      >
                        <img src={url} alt="完成照片" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {previewPhoto && <PhotoLightbox url={previewPhoto} onClose={() => setPreviewPhoto(null)} />}
    </div>
  );
};

export default TodayPage;

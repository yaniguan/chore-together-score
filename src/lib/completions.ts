import { normalizeFrequency } from '@/lib/constants';

interface CompletionLike {
  task_id: string;
  member_id: string;
  completed_at: string;
}

export const getDayBounds = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Monday-based week containing `date`.
export const getWeekBounds = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sunday. Shift so Monday is the first day.
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export const getMonthBounds = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * The window a task's `max_per_cycle` applies to. A daily task resets at
 * midnight, a weekly one on Monday, a monthly one on the 1st — so "洗油烟机,
 * max 1, monthly" can genuinely only be banked once a month.
 */
export const getCycleBounds = (frequency: string | null | undefined, date: Date) => {
  switch (normalizeFrequency(frequency)) {
    case 'daily':   return getDayBounds(date);
    case 'monthly': return getMonthBounds(date);
    default:        return getWeekBounds(date);
  }
};

export const CYCLE_LABEL: Record<string, string> = {
  daily: '今天',
  weekly: '本周',
  monthly: '本月',
};

export const cycleLabel = (frequency: string | null | undefined): string =>
  CYCLE_LABEL[normalizeFrequency(frequency)] ?? '本周';

const within = <T extends CompletionLike>(
  completions: T[],
  taskId: string,
  start: Date,
  end: Date,
  memberId?: string,
) =>
  completions.filter(completion => {
    if (completion.task_id !== taskId) return false;
    if (memberId && completion.member_id !== memberId) return false;
    const at = new Date(completion.completed_at);
    return at >= start && at <= end;
  });

export const getTaskCompletionsForDate = <T extends CompletionLike>(
  completions: T[],
  taskId: string,
  date: Date,
  memberId?: string,
) => {
  const { start, end } = getDayBounds(date);
  return within(completions, taskId, start, end, memberId);
};

/** Completions of `taskId` inside the cycle (day/week/month) containing `date`. */
export const getTaskCompletionsForCycle = <T extends CompletionLike>(
  completions: T[],
  task: { id: string; frequency: string },
  date: Date,
  memberId?: string,
) => {
  const { start, end } = getCycleBounds(task.frequency, date);
  return within(completions, task.id, start, end, memberId);
};

// Returns the number of consecutive days (counting back from today) that
// `memberId` has at least one completion. Pass `taskId` to restrict to a
// specific task. `maxDays` caps the look-back window (default 90).
export const calculateStreak = (
  completions: CompletionLike[],
  memberId: string,
  taskId?: string,
  maxDays = 90,
): number => {
  // Pre-bucket by local day so this is one pass instead of maxDays passes.
  const days = new Set<string>();
  for (const c of completions) {
    if (c.member_id !== memberId) continue;
    if (taskId && c.task_id !== taskId) continue;
    const d = new Date(c.completed_at);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  let streak = 0;
  for (let i = 0; i < maxDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (days.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)) streak++;
    else break;
  }
  return streak;
};

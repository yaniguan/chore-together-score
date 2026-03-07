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

export const getTaskCompletionsForDate = <T extends CompletionLike>(
  completions: T[],
  taskId: string,
  date: Date,
  memberId?: string
) => {
  const { start, end } = getDayBounds(date);

  return completions.filter((completion) => {
    const completedAt = new Date(completion.completed_at);

    return (
      completion.task_id === taskId &&
      completedAt >= start &&
      completedAt <= end &&
      (!memberId || completion.member_id === memberId)
    );
  });
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
  let streak = 0;
  for (let i = 0; i < maxDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const { start, end } = getDayBounds(d);
    const hit = completions.some(
      c =>
        c.member_id === memberId &&
        (!taskId || c.task_id === taskId) &&
        new Date(c.completed_at) >= start &&
        new Date(c.completed_at) <= end,
    );
    if (hit) streak++;
    else break;
  }
  return streak;
};

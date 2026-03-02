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

// Helpers for the monthly score cycle. Months are addressed by a "YYYY-MM"
// key built in local time so they line up with how users perceive a calendar
// month (we don't try to reconcile across time zones).

export const getMonthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// Half-open range [start, end) covering one local-time month.
export const getMonthRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
};

export const formatMonthLabel = (yearMonth: string): string => {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
};

// Edit window: only today is mutable. Past dates are view-only (you can
// still see what was completed, but no add/undo). The future is unreachable
// from the calendar UI.
export const isDateEditable = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target.getTime() === today.getTime();
};

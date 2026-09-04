import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getWeekBounds, getMonthBounds, getCycleBounds, getTaskCompletionsForCycle, calculateStreak,
} from '@/lib/completions';
import { daysLeftInMonth } from '@/lib/monthCycle';

const at = (iso: string) => ({ task_id: 't1', member_id: 'm1', completed_at: iso });

afterEach(() => vi.useRealTimers());

describe('getWeekBounds', () => {
  it('starts on Monday for a mid-week date', () => {
    // 2026-09-03 is a Thursday.
    const { start, end } = getWeekBounds(new Date(2026, 8, 3, 15, 0));
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(31); // Mon 2026-08-31
    expect(end.getDate()).toBe(6);    // Sun 2026-09-06
  });

  it('treats Sunday as the end of the week it closes, not the start', () => {
    // 2026-09-06 is a Sunday.
    const { start } = getWeekBounds(new Date(2026, 8, 6, 12, 0));
    expect(start.getDate()).toBe(31);
    expect(start.getMonth()).toBe(7); // August
  });
});

describe('getMonthBounds', () => {
  it('covers the 1st through the last day', () => {
    const { start, end } = getMonthBounds(new Date(2026, 8, 17));
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(30); // September has 30 days
    expect(end.getMonth()).toBe(8);
  });

  it('handles February in a leap year', () => {
    const { end } = getMonthBounds(new Date(2028, 1, 10));
    expect(end.getDate()).toBe(29);
  });
});

describe('getCycleBounds', () => {
  const d = new Date(2026, 8, 3, 10, 0);
  it('scopes daily tasks to the day', () => {
    expect(getCycleBounds('daily', d).start.getDate()).toBe(3);
  });
  it('scopes monthly tasks to the month', () => {
    expect(getCycleBounds('monthly', d).start.getDate()).toBe(1);
  });
  it('falls back to weekly for legacy "custom" frequency', () => {
    expect(getCycleBounds('custom', d).start.getDate()).toBe(31);
  });
});

describe('getTaskCompletionsForCycle', () => {
  const now = new Date(2026, 8, 3, 12, 0); // Thu

  it('counts a Monday completion against a weekly task on Thursday', () => {
    const rows = [at(new Date(2026, 7, 31, 9, 0).toISOString())]; // Mon
    const found = getTaskCompletionsForCycle(rows, { id: 't1', frequency: 'weekly' }, now);
    expect(found).toHaveLength(1);
  });

  it('does NOT count that Monday against a daily task on Thursday', () => {
    const rows = [at(new Date(2026, 7, 31, 9, 0).toISOString())];
    const found = getTaskCompletionsForCycle(rows, { id: 't1', frequency: 'daily' }, now);
    expect(found).toHaveLength(0);
  });

  it('excludes the previous week from a weekly task', () => {
    const rows = [at(new Date(2026, 7, 30, 9, 0).toISOString())]; // Sun, prior week
    const found = getTaskCompletionsForCycle(rows, { id: 't1', frequency: 'weekly' }, now);
    expect(found).toHaveLength(0);
  });

  it('keeps a monthly task capped across the whole month', () => {
    const rows = [at(new Date(2026, 8, 1, 9, 0).toISOString())];
    const found = getTaskCompletionsForCycle(rows, { id: 't1', frequency: 'monthly' }, now);
    expect(found).toHaveLength(1);
  });

  it('filters by member when asked', () => {
    const rows = [
      { task_id: 't1', member_id: 'm1', completed_at: now.toISOString() },
      { task_id: 't1', member_id: 'm2', completed_at: now.toISOString() },
    ];
    expect(getTaskCompletionsForCycle(rows, { id: 't1', frequency: 'daily' }, now, 'm2')).toHaveLength(1);
  });
});

describe('calculateStreak', () => {
  it('counts consecutive days back from today and stops at the first gap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 3, 12, 0));
    const day = (offset: number) => {
      const d = new Date(2026, 8, 3, 10, 0);
      d.setDate(d.getDate() - offset);
      return at(d.toISOString());
    };
    // today, -1, -2, then a gap at -3, then -4
    const rows = [day(0), day(1), day(2), day(4)];
    expect(calculateStreak(rows, 'm1')).toBe(3);
  });

  it('is 0 when nothing was done today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 3, 12, 0));
    expect(calculateStreak([at(new Date(2026, 8, 1).toISOString())], 'm1')).toBe(0);
  });
});

describe('daysLeftInMonth', () => {
  it('counts today as remaining', () => {
    expect(daysLeftInMonth(new Date(2026, 8, 30, 23, 0))).toBe(1);
  });
  it('covers a full month from the 1st', () => {
    expect(daysLeftInMonth(new Date(2026, 8, 1, 0, 0))).toBe(30);
  });
});

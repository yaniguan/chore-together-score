import { describe, expect, it } from 'vitest';
import { getDayBounds, getTaskCompletionsForDate } from '@/lib/completions';
import { parseStoredHouseholdMember } from '@/lib/householdStorage';

describe('parseStoredHouseholdMember', () => {
  it('returns null for malformed JSON', () => {
    expect(parseStoredHouseholdMember('{not-json')).toBeNull();
  });

  it('returns null for an unexpected object shape', () => {
    expect(parseStoredHouseholdMember(JSON.stringify({ id: '1' }))).toBeNull();
  });

  it('returns the member for valid stored data', () => {
    expect(
      parseStoredHouseholdMember(
        JSON.stringify({
          id: 'member-1',
          household_id: 'house-1',
          display_name: 'Alex',
          avatar_color: '#0D9488',
        })
      )
    ).toEqual({
      id: 'member-1',
      household_id: 'house-1',
      display_name: 'Alex',
      avatar_color: '#0D9488',
    });
  });
});

describe('getTaskCompletionsForDate', () => {
  it('only returns completions that match the same local day and optional member', () => {
    const selectedDate = new Date('2026-03-02T09:00:00');
    const { start, end } = getDayBounds(selectedDate);

    const completions = [
      {
        task_id: 'task-1',
        member_id: 'member-a',
        completed_at: new Date(start.getTime() + 60_000).toISOString(),
      },
      {
        task_id: 'task-1',
        member_id: 'member-a',
        completed_at: new Date(end.getTime() - 60_000).toISOString(),
      },
      {
        task_id: 'task-1',
        member_id: 'member-b',
        completed_at: new Date(start.getTime() + 120_000).toISOString(),
      },
      {
        task_id: 'task-1',
        member_id: 'member-a',
        completed_at: new Date(start.getTime() - 1).toISOString(),
      },
      {
        task_id: 'task-2',
        member_id: 'member-a',
        completed_at: new Date(start.getTime() + 60_000).toISOString(),
      },
    ];

    expect(getTaskCompletionsForDate(completions, 'task-1', selectedDate)).toHaveLength(3);
    expect(getTaskCompletionsForDate(completions, 'task-1', selectedDate, 'member-a')).toHaveLength(2);
  });
});

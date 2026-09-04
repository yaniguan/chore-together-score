import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Supabase stub ─────────────────────────────────────────────────────────
// Every page talks to the same client, so one chainable stub covers them all.
const tableRows: Record<string, unknown[]> = {};
let forcedError: { message: string } | null = null;

const makeQuery = (table: string) => {
  const result = Promise.resolve(
    forcedError ? { data: null, error: forcedError } : { data: tableRows[table] ?? [], error: null },
  );
  const chain: Record<string, unknown> = {
    then: result.then.bind(result),
    catch: result.catch.bind(result),
    finally: result.finally.bind(result),
  };
  for (const m of ['select', 'eq', 'gte', 'lte', 'lt', 'order', 'limit', 'insert', 'update', 'delete', 'upsert']) {
    chain[m] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  chain.single = () => Promise.resolve({ data: null, error: null });
  return chain;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
    channel: () => {
      const ch: Record<string, unknown> = {};
      ch.on = () => ch;
      ch.subscribe = () => ch;
      return ch;
    },
    removeChannel: () => {},
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}));

vi.mock('canvas-confetti', () => ({ default: () => {} }));

import { HouseholdProvider } from '@/context/HouseholdContext';
import TodayPage from '@/pages/TodayPage';
import MonthPage from '@/pages/MonthPage';
import RewardsPage from '@/pages/RewardsPage';
import SettingsPage from '@/pages/SettingsPage';
import TasksPage from '@/pages/TasksPage';
import ShoppingPage from '@/pages/ShoppingPage';
import AppLayout from '@/components/AppLayout';

const MEMBERS = [
  { id: 'm1', household_id: 'h1', display_name: 'Yani', avatar_color: '#0D9488' },
  { id: 'm2', household_id: 'h1', display_name: 'Sam', avatar_color: '#F97066' },
];

const TASKS = [
  { id: 't1', household_id: 'h1', name: '洗碗', icon: 'utensils', category: 'kitchen',
    frequency: 'daily', frequency_value: 1, max_per_cycle: 3, points: 4,
    assigned_to: 'both', color_tag: '#F59E0B', sort_order: 20, created_by: null, created_at: '2026-09-01T00:00:00Z' },
  { id: 't2', household_id: 'h1', name: '洗油烟机', icon: 'air-vent', category: 'kitchen',
    frequency: 'monthly', frequency_value: 1, max_per_cycle: 1, points: 8,
    assigned_to: 'both', color_tag: '#F59E0B', sort_order: 30, created_by: null, created_at: '2026-09-02T00:00:00Z' },
  // Legacy row: emoji icon + a category that no longer exists.
  { id: 't3', household_id: 'h1', name: '旧任务', icon: '🍳', category: 'living_room',
    frequency: 'custom', frequency_value: 1, max_per_cycle: 1, points: 2,
    assigned_to: 'both', color_tag: '#6B7280', sort_order: null, created_by: null, created_at: '2026-09-03T00:00:00Z' },
  // Same area as t1/t2 but positioned first, despite being created last.
  { id: 't4', household_id: 'h1', name: '做早餐', icon: 'egg', category: 'kitchen',
    frequency: 'daily', frequency_value: 1, max_per_cycle: 1, points: 2,
    assigned_to: 'both', color_tag: '#F59E0B', sort_order: 10, created_by: null, created_at: '2026-09-09T00:00:00Z' },
  // Never dragged, so it has no position — must fall to the end of 厨房 even
  // though it is the oldest row in the area.
  { id: 't5', household_id: 'h1', name: '擦灶台', icon: 'flame', category: 'kitchen',
    frequency: 'daily', frequency_value: 1, max_per_cycle: 1, points: 3,
    assigned_to: 'both', color_tag: '#F59E0B', sort_order: null, created_by: null, created_at: '2026-08-01T00:00:00Z' },
];

const withApp = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <HouseholdProvider>{ui}</HouseholdProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.setItem('homepace_household_id', 'h1');
  localStorage.setItem('homepace_member', JSON.stringify(MEMBERS[0]));
  tableRows.household_members = MEMBERS;
  tableRows.tasks = TASKS;
  tableRows.completions = [];
  tableRows.rewards = [];
  tableRows.redemptions = [];
  tableRows.monthly_scores = [];
  tableRows.shopping_items = [];
  tableRows.households = [];
  forcedError = null;
});

describe('pages render without crashing', () => {
  it('TodayPage shows the duel card and daily tasks', async () => {
    withApp(<TodayPage />);
    expect(await screen.findByText('本月对决')).toBeInTheDocument();
    expect(await screen.findByText('洗碗')).toBeInTheDocument();
    // Default filter is 每天, so the monthly task is hidden.
    expect(screen.queryByText('洗油烟机')).not.toBeInTheDocument();
  });

  it('TodayPage progress denominator counts daily tasks only', async () => {
    withApp(<TodayPage />);
    // Daily only: 洗碗 3×4 + 做早餐 1×2 + 擦灶台 1×3 = 17. The 8-point monthly task must not inflate it.
    expect(await screen.findByText('/ 17 分')).toBeInTheDocument();
  });

  it('MonthPage renders', async () => {
    withApp(<MonthPage />);
    expect(await screen.findByText('本月对决')).toBeInTheDocument();
  });

  it('RewardsPage renders its empty state', async () => {
    withApp(<RewardsPage />);
    expect(await screen.findByText('还没有奖励，加几个想要的吧')).toBeInTheDocument();
  });

  it('SettingsPage renders and links to task management', async () => {
    withApp(<SettingsPage />);
    expect(await screen.findByText('管理任务')).toBeInTheDocument();
    expect(await screen.findByText('加入密码 · 伴侣换设备时需要')).toBeInTheDocument();
  });

  it('TasksPage renders every task, legacy rows included', async () => {
    withApp(<TasksPage />);
    expect(await screen.findByText('洗碗')).toBeInTheDocument();
    expect(await screen.findByText('洗油烟机')).toBeInTheDocument();
    // Legacy "living_room" category falls back into 其他 rather than vanishing.
    expect(await screen.findByText('旧任务')).toBeInTheDocument();
  });

  it('ShoppingPage renders', async () => {
    withApp(<ShoppingPage />);
    expect(await screen.findByText('购物清单')).toBeInTheDocument();
  });

  it('AppLayout exposes exactly the four tabs', async () => {
    withApp(<AppLayout><div /></AppLayout>);
    const nav = document.querySelector('nav')!;
    for (const label of ['今天', '本月', '购物', '奖励']) {
      expect(within(nav as HTMLElement).getByText(label)).toBeInTheDocument();
    }
    expect(within(nav as HTMLElement).queryByText('任务')).not.toBeInTheDocument();
  });
});

describe('database failure', () => {
  it('shows a connection banner instead of an empty-looking household', async () => {
    forcedError = { message: 'FetchError: failed to fetch' };
    withApp(<AppLayout><TodayPage /></AppLayout>);
    expect(await screen.findByText('连不上数据库，显示的可能不是最新数据')).toBeInTheDocument();
    // The misleading "no tasks yet" copy must not be what the user sees.
    expect(screen.queryByText(/还没有任务/)).not.toBeInTheDocument();
  });
});

describe('manual task order', () => {
  const KITCHEN = ['做早餐', '洗碗', '洗油烟机', '擦灶台'];
  const kitchenOrder = () =>
    Array.from(document.querySelectorAll('p.text-sm.font-medium'))
      .map(el => el.textContent ?? '')
      .filter(n => KITCHEN.includes(n));

  it('renders tasks by sort_order, not creation order', async () => {
    withApp(<TasksPage />);
    await screen.findByText('擦灶台');
    // 做早餐 is newest but positioned first; 擦灶台 is oldest but unpositioned,
    // so it lands at the end rather than the front.
    expect(kitchenOrder()).toEqual(['做早餐', '洗碗', '洗油烟机', '擦灶台']);
  });

  it('sort mode drops the frequency filter so nothing is hidden mid-drag', async () => {
    withApp(<TodayPage />);
    await screen.findByText('洗碗');
    // Default 每天 filter hides the monthly task.
    expect(screen.queryByText('洗油烟机')).not.toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByTitle('调整任务顺序')); });

    expect(await screen.findByText('洗油烟机')).toBeInTheDocument();
    expect(screen.getByText('拖动任务调整顺序，可在同一区域内移动')).toBeInTheDocument();

    // Leaving sort mode restores the filter you came from.
    await act(async () => { fireEvent.click(screen.getByText('完成')); });
    expect(screen.queryByText('洗油烟机')).not.toBeInTheDocument();
  });
});

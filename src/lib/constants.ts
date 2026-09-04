export type CategoryValue = 'kitchen' | 'bathroom' | 'cleaning' | 'laundry' | 'dog' | 'other';

// Areas of a 1b1b apartment. `icon` is a key into the registry in
// lib/taskIcons.tsx — no emoji anywhere in the UI any more.
export const CATEGORIES: { value: CategoryValue; label: string; icon: string }[] = [
  { value: 'kitchen',  label: '厨房',   icon: 'cooking-pot' },
  { value: 'bathroom', label: '卫生间', icon: 'shower' },
  { value: 'cleaning', label: '打扫',   icon: 'sparkles' },
  { value: 'laundry',  label: '洗衣',   icon: 'washing-machine' },
  { value: 'dog',      label: '狗',     icon: 'dog' },
  { value: 'other',    label: '其他',   icon: 'house' },
];

const KNOWN: ReadonlySet<string> = new Set(CATEGORIES.map(c => c.value));

// Tasks created with legacy categories ("living_room", "bedroom", null …)
// are grouped under "other" so the UI stays clean after the simplification.
export const normalizeCategory = (value: string | null | undefined): CategoryValue => {
  if (value && KNOWN.has(value)) return value as CategoryValue;
  return 'other';
};

export type FrequencyValue = 'daily' | 'weekly' | 'monthly';

export const FREQUENCIES: { value: FrequencyValue; label: string }[] = [
  { value: 'daily',   label: '每天' },
  { value: 'weekly',  label: '每周' },
  { value: 'monthly', label: '每月' },
];

const KNOWN_FREQ: ReadonlySet<string> = new Set(FREQUENCIES.map(f => f.value));

// Legacy tasks may carry frequency "custom"; treat anything unknown as weekly
// so it still shows up somewhere sensible.
export const normalizeFrequency = (value: string | null | undefined): FrequencyValue => {
  if (value && KNOWN_FREQ.has(value)) return value as FrequencyValue;
  return 'weekly';
};

export const frequencyLabel = (value: string | null | undefined): string =>
  FREQUENCIES.find(f => f.value === normalizeFrequency(value))?.label ?? '每周';

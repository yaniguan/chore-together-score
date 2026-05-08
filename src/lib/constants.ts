export type CategoryValue = 'kitchen' | 'bathroom' | 'dog' | 'other';

export const CATEGORIES: { value: CategoryValue; label: string; emoji: string }[] = [
  { value: 'kitchen',  label: '厨房',     emoji: '🍳' },
  { value: 'bathroom', label: '厕所',     emoji: '🚿' },
  { value: 'dog',      label: '狗',       emoji: '🐕' },
  { value: 'other',    label: '其他综合', emoji: '🧹' },
];

const KNOWN: ReadonlySet<string> = new Set(CATEGORIES.map(c => c.value));

// Tasks created with legacy categories ("living_room", "bedroom", null …)
// are grouped under "other" so the UI stays clean after the simplification.
export const normalizeCategory = (value: string | null | undefined): CategoryValue => {
  if (value && KNOWN.has(value)) return value as CategoryValue;
  return 'other';
};

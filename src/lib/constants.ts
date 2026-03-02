export type CategoryValue = 'kitchen' | 'bedroom' | 'bathroom' | 'living_room' | 'dog' | 'other';

export const CATEGORIES: { value: CategoryValue; label: string; emoji: string }[] = [
  { value: 'kitchen',     label: 'Kitchen',     emoji: '🍳' },
  { value: 'bedroom',     label: 'Bedroom',     emoji: '🛏️' },
  { value: 'bathroom',    label: 'Bathroom',    emoji: '🚿' },
  { value: 'living_room', label: 'Living Room', emoji: '🛋️' },
  { value: 'dog',         label: 'Dog',         emoji: '🐕' },
  { value: 'other',       label: 'Other',       emoji: '📦' },
];

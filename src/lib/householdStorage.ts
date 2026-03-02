interface StoredHouseholdMember {
  id: string;
  household_id: string;
  display_name: string;
  avatar_color: string;
}

const isStoredHouseholdMember = (value: unknown): value is StoredHouseholdMember => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.household_id === 'string' &&
    typeof candidate.display_name === 'string' &&
    typeof candidate.avatar_color === 'string'
  );
};

export const parseStoredHouseholdMember = (raw: string | null): StoredHouseholdMember | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return isStoredHouseholdMember(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

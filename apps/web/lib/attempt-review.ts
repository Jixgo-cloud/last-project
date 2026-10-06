interface ReviewAttempt {
  id: string;
  assessment?: Record<string, unknown>;
  candidate?: Record<string, unknown>;
}

/** The score endpoint returns a compact record, not the full review with answers. */
export function mergeAttemptReview<T extends ReviewAttempt>(current: T, updated: Partial<T>): T {
  if (current.id !== updated.id) return current;
  return {
    ...current,
    ...updated,
    assessment: { ...current.assessment, ...updated.assessment },
    candidate: { ...current.candidate, ...updated.candidate },
  };
}

/** A failed list refresh must not turn a successful score save into a save failure. */
export async function saveAttemptReview<T>(
  save: () => Promise<T>,
  onSaved: (updated: T) => void,
  refresh: () => Promise<void>,
): Promise<{ refreshFailed: boolean }> {
  const updated = await save();
  onSaved(updated);
  try {
    await refresh();
    return { refreshFailed: false };
  } catch {
    return { refreshFailed: true };
  }
}

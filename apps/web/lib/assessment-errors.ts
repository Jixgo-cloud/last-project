export function getCodingFailureKind(error: unknown): 'unavailable' | 'rate-limit' | 'other' {
  if (!error || typeof error !== 'object') return 'other';
  const { status, message } = error as { status?: number; message?: string };
  if (status === 503) return 'unavailable';
  if (status === 429) return 'rate-limit';
  // apiRequest preserves the HTTP status even when the message has no status code.
  if (typeof status === 'number') return 'other';
  if (typeof message !== 'string') return 'other';
  if (message.includes('429') || message.includes('3 วินาที')) return 'rate-limit';
  if (message.includes('503') || message.includes('JUDGE_UNAVAILABLE') || message.includes('Judge0')) return 'unavailable';
  return 'other';
}

let migration: Promise<void> | null = null;

async function migrateLegacySession() {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('smartcareer_token');
  if (!token) return;
  if (!migration) migration = (async () => {
    const response = await fetch('/api/auth/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }), credentials: 'same-origin',
    });
    if (!response.ok && response.status !== 401) throw new Error('Unable to restore your session. Please try again.');
    localStorage.removeItem('smartcareer_token');
  })().catch(error => { migration = null; throw error; });
  await migration;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  await migrateLegacySession();
  const res = await fetch('/api' + (endpoint.startsWith('/') ? endpoint : '/' + endpoint), {
    ...options, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    let message = 'An error occurred during request';
    try {
      const data = await res.json();
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message || message;
    } catch { /* keep generic message */ }
    throw new Error(message);
  }
  return res.json();
}

export const OAUTH_VERIFIER_KEY = 'smartcareer_oauth_verifier';

export async function beginOAuth(provider: 'google' | 'github', role: string, mode: 'login' | 'register') {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...hash)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  const query = new URLSearchParams({ role, mode, origin: window.location.origin, challenge });
  window.location.assign(api.replace(/\/$/, '') + '/auth/' + provider + '?' + query.toString());
}

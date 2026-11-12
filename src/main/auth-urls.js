export const REDIRECT_URI = 'http://localhost/auth/callback';
export const SCOPES = ['user:read:follows'];

export function buildAuthorizeUrl({ clientId, state, forceVerify = false }) {
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('state', state);
  if (forceVerify) url.searchParams.set('force_verify', 'true');
  return url.toString();
}

// Implicit grant: the token comes back in the fragment, errors in the query.
export function parseRedirect(url, expectedState) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  for (const [key, value] of parsed.searchParams) if (!params.has(key)) params.set(key, value);
  if (params.get('error')) return { error: params.get('error') };
  if (params.get('state') !== expectedState) return { error: 'state_mismatch' };
  const token = params.get('access_token');
  return token ? { token } : { error: 'missing_token' };
}

export function classifyAuthUrl(url) {
  if (url.startsWith(REDIRECT_URI)) return 'callback';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'other';
  }
  const host = parsed.hostname;
  // Google refuses to sign in inside an app ("this browser or app may not
  // be secure").
  if (host === 'accounts.google.com' && /\/signin\/(v2\/)?\w*rejected/.test(parsed.pathname)) return 'google-blocked';
  if (host === 'id.twitch.tv' && parsed.pathname.startsWith('/oauth2/authorize')) return 'consent';
  if (host === 'twitch.tv' || host.endsWith('.twitch.tv') || host === 'accounts.google.com') return 'login';
  return 'other';
}

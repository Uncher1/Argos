import { isTwitchUrl } from './navigation.js';

// Twitch's sign-in page asks Windows for a passkey as soon as it opens. In
// Argos that only brings up a Windows "insert your security key" dialog, so
// Twitch's pages are told passkeys are off and never ask.
export const PASSKEYS_OFF = 'publickey-credentials-get=(), publickey-credentials-create=()';

export function isTwitchDocument({ url, resourceType }) {
  return (resourceType === 'mainFrame' || resourceType === 'subFrame') && isTwitchUrl(url);
}

// When a header repeats a rule, the last one wins: ours goes last.
export function withoutPasskeys(headers) {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'permissions-policy') ?? 'Permissions-Policy';
  return { ...headers, [key]: [...(headers[key] ?? []), PASSKEYS_OFF] };
}

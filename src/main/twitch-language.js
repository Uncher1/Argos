import { acceptLanguage } from '../renderer/i18n/languages.js';

const YEAR = 365 * 24 * 3600;

const isTwitch = (domain) => {
  const host = String(domain ?? '').replace(/^\./, '');
  return host === 'twitch.tv' || host.endsWith('.twitch.tv');
};

// Twitch pages (sign-in, consent, channel pages, players) take their language
// from Twitch's own "language" cookie, not from the browser's language.
export function languageCookie(code, now = Date.now()) {
  return {
    url: 'https://www.twitch.tv',
    domain: '.twitch.tv',
    path: '/',
    name: 'language',
    value: code,
    secure: true,
    sameSite: 'no_restriction',
    expirationDate: Math.floor(now / 1000) + YEAR,
  };
}

export function needsLanguageFix(cookie, code) {
  return cookie.name === 'language' && isTwitch(cookie.domain) && cookie.value !== code;
}

// Applies the language to every Twitch page of the session, and puts it back
// if Twitch changes it (for example to the account's language after sign-in).
export function keepTwitchLanguage(ses, getCode) {
  const apply = () => {
    const code = getCode();
    if (!code) return;
    ses.setUserAgent(ses.getUserAgent(), acceptLanguage(code));
    ses.cookies.set(languageCookie(code)).catch(() => {});
  };
  ses.cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (removed) return;
    const code = getCode();
    if (code && needsLanguageFix(cookie, code)) ses.cookies.set(languageCookie(code)).catch(() => {});
  });
  apply();
  return apply;
}

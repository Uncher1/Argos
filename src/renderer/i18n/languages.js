// The languages Argos speaks, each named in its own language. The code is
// also the value of Twitch's "language" cookie, so Twitch pages follow it.
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt-br', name: 'Português (Brasil)' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh-cn', name: '简体中文' },
];

export const FALLBACK_LANGUAGE = 'en';

const base = (tag) => String(tag).toLowerCase().split('-')[0];

export const isSupported = (code) => LANGUAGES.some((l) => l.code === code);

// First system language Argos speaks (Portuguese and Chinese map to the
// variant offered), English otherwise.
export function matchLanguage(preferred = []) {
  for (const tag of preferred) {
    const lower = String(tag).toLowerCase();
    const exact = LANGUAGES.find((l) => l.code === lower);
    if (exact) return exact.code;
    const close = LANGUAGES.find((l) => base(l.code) === base(lower));
    if (close) return close.code;
  }
  return FALLBACK_LANGUAGE;
}

// BCP 47 tag for Intl and browsers: "pt-br" becomes "pt-BR".
export const localeTag = (code) => code.replace(/-(\w+)$/, (_, region) => `-${region.toUpperCase()}`);

export function acceptLanguage(code) {
  const tag = localeTag(code);
  const parts = [tag];
  if (base(tag) !== tag) parts.push(`${base(tag)};q=0.9`);
  if (base(tag) !== 'en') parts.push('en;q=0.8');
  return parts.join(',');
}

// Language a stream is broadcast in, as Twitch's API names it.
export const streamLanguage = (code) => base(code);

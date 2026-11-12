import { getLanguage } from './i18n/index.js';
import { localeTag } from './i18n/languages.js';

// Followed channels that are not live, in alphabetical order (like a contact
// list: case and accents do not matter), sorted the way the language sorts.
export function offlineFollows(followed, liveLogins) {
  const collator = new Intl.Collator(localeTag(getLanguage()), { sensitivity: 'base' });
  return followed.filter((f) => !liveLogins.has(f.login)).sort((a, b) => collator.compare(a.name, b.name));
}

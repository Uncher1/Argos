import { FALLBACK_LANGUAGE, isSupported, localeTag } from './languages.js';
import de from './messages/de.js';
import en from './messages/en.js';
import es from './messages/es.js';
import fr from './messages/fr.js';
import it from './messages/it.js';
import ja from './messages/ja.js';
import ko from './messages/ko.js';
import pl from './messages/pl.js';
import ptBr from './messages/pt-br.js';
import ru from './messages/ru.js';
import tr from './messages/tr.js';
import zhCn from './messages/zh-cn.js';

export const MESSAGES = {
  en, fr, es, de, it, 'pt-br': ptBr, pl, tr, ru, ja, ko, 'zh-cn': zhCn,
};

// t(key, params): the text in the given language (English if missing), with
// {name} placeholders filled in. A text can be an object of plural forms
// (one, few, many, other...) chosen with params.count.
export function createTranslator(code) {
  const lang = isSupported(code) ? code : FALLBACK_LANGUAGE;
  const tag = localeTag(lang);
  const plural = new Intl.PluralRules(tag);
  const number = new Intl.NumberFormat(tag);
  return function translate(key, params = {}) {
    let text = MESSAGES[lang][key] ?? MESSAGES[FALLBACK_LANGUAGE][key];
    if (text === undefined) return key;
    if (typeof text === 'object') text = text[plural.select(params.count ?? 0)] ?? text.other;
    return text.replace(/\{(\w+)\}/g, (match, name) => {
      if (!(name in params)) return match;
      const value = params[name];
      return typeof value === 'number' ? number.format(value) : String(value);
    });
  };
}

let currentCode = FALLBACK_LANGUAGE;
let current = createTranslator(FALLBACK_LANGUAGE);

// The language of the whole page, chosen once at start-up.
export function setLanguage(code) {
  currentCode = isSupported(code) ? code : FALLBACK_LANGUAGE;
  current = createTranslator(currentCode);
}

export const getLanguage = () => currentCode;

export const t = (key, params) => current(key, params);

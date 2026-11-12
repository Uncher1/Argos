import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, createTranslator, getLanguage, setLanguage, t } from '../src/renderer/i18n/index.js';
import { LANGUAGES } from '../src/renderer/i18n/languages.js';

const placeholders = (value) => {
  const texts = typeof value === 'string' ? [value] : Object.values(value);
  return [...new Set(texts.flatMap((s) => s.match(/\{\w+\}/g) ?? []))].sort();
};

test('a key is translated in the chosen language', () => {
  assert.equal(createTranslator('fr')('stream.offline'), 'Hors ligne');
  assert.equal(createTranslator('en')('stream.offline'), 'Offline');
});

test('an unknown language falls back to English', () => {
  assert.equal(createTranslator('nl')('stream.offline'), 'Offline');
});

test('an unknown key is shown as is', () => {
  assert.equal(createTranslator('en')('nope.missing'), 'nope.missing');
});

test('parameters are filled in, numbers in the local format', () => {
  assert.equal(createTranslator('en')('picker.slot', { n: 2 }), 'Slot 2');
  assert.equal(createTranslator('fr')('picker.offline', { count: 1204 }), 'Hors ligne (1 204)');
});

test('plural forms follow the language rules', () => {
  const en = createTranslator('en');
  assert.equal(en('picker.liveCount', { count: 1, plus: '' }), '1 live stream');
  assert.equal(en('picker.liveCount', { count: 3, plus: '+' }), '3+ live streams');
  const ru = createTranslator('ru');
  assert.notEqual(ru('picker.showMore', { count: 2 }), ru('picker.showMore', { count: 5 }));
});

test('the current language is shared by the whole page', () => {
  setLanguage('de');
  assert.equal(getLanguage(), 'de');
  assert.equal(t('stream.offline'), MESSAGES.de['stream.offline']);
  setLanguage('nl');
  assert.equal(getLanguage(), 'en');
});

test('every language has every English text, with the same placeholders', () => {
  const keys = Object.keys(MESSAGES.en).sort();
  for (const { code } of LANGUAGES) {
    const messages = MESSAGES[code];
    assert.ok(messages, `missing messages for ${code}`);
    assert.deepEqual(Object.keys(messages).sort(), keys, `keys of ${code}`);
    for (const key of keys) {
      assert.deepEqual(placeholders(messages[key]), placeholders(MESSAGES.en[key]), `${code} ${key}`);
      if (typeof messages[key] === 'object') assert.ok(messages[key].other, `${code} ${key} needs "other"`);
    }
  }
});

test('no long dash in any text', () => {
  for (const [code, messages] of Object.entries(MESSAGES)) {
    for (const [key, value] of Object.entries(messages)) {
      const texts = typeof value === 'string' ? [value] : Object.values(value);
      for (const text of texts) assert.doesNotMatch(text, /[\u2013\u2014]/, `${code} ${key}`);
    }
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGES, acceptLanguage, isSupported, localeTag, matchLanguage, streamLanguage,
} from '../src/renderer/i18n/languages.js';

test('twelve languages, each named in its own language', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code),
    ['en', 'fr', 'es', 'de', 'it', 'pt-br', 'pl', 'tr', 'ru', 'ja', 'ko', 'zh-cn']);
  assert.equal(LANGUAGES.find((l) => l.code === 'de').name, 'Deutsch');
  assert.equal(LANGUAGES.find((l) => l.code === 'ja').name, '日本語');
});

test('only the listed languages are supported', () => {
  assert.equal(isSupported('fr'), true);
  assert.equal(isSupported('pt-br'), true);
  assert.equal(isSupported('nl'), false);
  assert.equal(isSupported(null), false);
});

test('the system language picks the closest supported language', () => {
  assert.equal(matchLanguage(['fr-FR', 'en-US']), 'fr');
  assert.equal(matchLanguage(['pt-PT']), 'pt-br');
  assert.equal(matchLanguage(['zh-Hant-TW']), 'zh-cn');
  assert.equal(matchLanguage(['nl-NL', 'de-DE']), 'de');
  assert.equal(matchLanguage(['nl-NL']), 'en');
  assert.equal(matchLanguage([]), 'en');
});

test('locale tags for Intl and browsers', () => {
  assert.equal(localeTag('fr'), 'fr');
  assert.equal(localeTag('pt-br'), 'pt-BR');
  assert.equal(localeTag('zh-cn'), 'zh-CN');
});

test('Accept-Language header, English last', () => {
  assert.equal(acceptLanguage('en'), 'en');
  assert.equal(acceptLanguage('fr'), 'fr,en;q=0.8');
  assert.equal(acceptLanguage('pt-br'), 'pt-BR,pt;q=0.9,en;q=0.8');
});

test('broadcast language used to filter streams', () => {
  assert.equal(streamLanguage('fr'), 'fr');
  assert.equal(streamLanguage('pt-br'), 'pt');
  assert.equal(streamLanguage('zh-cn'), 'zh');
});

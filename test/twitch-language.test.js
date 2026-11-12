import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageCookie, needsLanguageFix } from '../src/main/twitch-language.js';

test("Twitch's own language cookie, readable by the embedded players", () => {
  const cookie = languageCookie('pt-br', 1_000_000);
  assert.equal(cookie.url, 'https://www.twitch.tv');
  assert.equal(cookie.domain, '.twitch.tv');
  assert.equal(cookie.name, 'language');
  assert.equal(cookie.value, 'pt-br');
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, 'no_restriction');
  assert.ok(cookie.expirationDate > 1_000_000 / 1000 + 300 * 24 * 3600);
});

test('a Twitch language cookie set to another language is put back', () => {
  const twitch = { domain: '.twitch.tv', name: 'language', value: 'fr' };
  assert.equal(needsLanguageFix(twitch, 'de'), true);
  assert.equal(needsLanguageFix(twitch, 'fr'), false);
  assert.equal(needsLanguageFix({ ...twitch, domain: 'www.twitch.tv' }, 'de'), true);
  assert.equal(needsLanguageFix({ ...twitch, name: 'unique_id' }, 'de'), false);
  assert.equal(needsLanguageFix({ ...twitch, domain: '.example.com' }, 'de'), false);
});

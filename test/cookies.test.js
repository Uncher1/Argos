import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsSameSiteFix, toSetDetails } from '../src/main/cookies.js';

test('needs fixing', () => {
  assert.equal(needsSameSiteFix({ domain: '.twitch.tv', sameSite: 'lax' }), true);
  assert.equal(needsSameSiteFix({ domain: 'www.twitch.tv', sameSite: 'unspecified' }), true);
  assert.equal(needsSameSiteFix({ domain: '.twitch.tv', sameSite: 'no_restriction' }), false);
  assert.equal(needsSameSiteFix({ domain: '.google.com', sameSite: 'lax' }), false);
  assert.equal(needsSameSiteFix({ domain: 'nottwitch.tv', sameSite: 'lax' }), false);
});

test('details', () => {
  const d = toSetDetails({
    name: 'auth-token', value: 'v', domain: '.twitch.tv', path: '/', hostOnly: false,
    httpOnly: false, secure: true, sameSite: 'lax', expirationDate: 2e9,
  });
  assert.deepEqual(d, {
    url: 'https://twitch.tv/', name: 'auth-token', value: 'v', domain: '.twitch.tv', path: '/',
    secure: true, httpOnly: false, expirationDate: 2e9, sameSite: 'no_restriction',
  });
});

test('host-only cookie: no domain', () => {
  const d = toSetDetails({ name: 'n', value: 'v', domain: 'www.twitch.tv', path: '/', hostOnly: true, httpOnly: true, secure: true, sameSite: 'lax' });
  assert.equal('domain' in d, false);
  assert.equal(d.url, 'https://www.twitch.tv/');
  assert.equal('expirationDate' in d, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSKEYS_OFF, isTwitchDocument, withoutPasskeys } from '../src/main/passkeys.js';

test('passkeys turned off on a Twitch page without a policy', () => {
  assert.deepEqual(withoutPasskeys({ 'Content-Type': ['text/html'] }), {
    'Content-Type': ['text/html'],
    'Permissions-Policy': [PASSKEYS_OFF],
  });
});

test('Twitch policy kept, ours comes last', () => {
  assert.deepEqual(withoutPasskeys({ 'permissions-policy': ['camera=()'] }), {
    'permissions-policy': ['camera=()', PASSKEYS_OFF],
  });
});

test('the policy turns off reading and creating passkeys', () => {
  assert.equal(PASSKEYS_OFF, 'publickey-credentials-get=(), publickey-credentials-create=()');
});

test('only Twitch pages, not their images or other sites', () => {
  assert.equal(isTwitchDocument({ url: 'https://www.twitch.tv/login', resourceType: 'mainFrame' }), true);
  assert.equal(isTwitchDocument({ url: 'https://passport.twitch.tv/x', resourceType: 'subFrame' }), true);
  assert.equal(isTwitchDocument({ url: 'https://www.twitch.tv/logo.png', resourceType: 'image' }), false);
  assert.equal(isTwitchDocument({ url: 'https://accounts.google.com/', resourceType: 'mainFrame' }), false);
});

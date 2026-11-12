import { test } from 'node:test';
import assert from 'node:assert/strict';
import { twitchChannelUrl } from '../src/main/twitch-page-url.js';

test('Twitch page of a channel', () => {
  assert.equal(twitchChannelUrl('Kamet0'), 'https://www.twitch.tv/kamet0/about');
  assert.equal(twitchChannelUrl('otplol_'), 'https://www.twitch.tv/otplol_/about');
});

test('invalid logins refused', () => {
  assert.equal(twitchChannelUrl('../settings'), null);
  assert.equal(twitchChannelUrl('a b'), null);
  assert.equal(twitchChannelUrl(''), null);
  assert.equal(twitchChannelUrl('x'.repeat(26)), null);
  assert.equal(twitchChannelUrl(null), null);
});

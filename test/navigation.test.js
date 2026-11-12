import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalTarget, isAppUrl } from '../src/main/navigation.js';

test('app pages', () => {
  assert.equal(isAppUrl('http://localhost/'), true);
  assert.equal(isAppUrl('http://localhost/index.html?x'), true);
  assert.equal(isAppUrl('file:///C:/Users/hp/image.png'), false);
  assert.equal(isAppUrl('https://www.twitch.tv/'), false);
  assert.equal(isAppUrl('http://localhost.evil.com/'), false);
});

test('links opened in the browser', () => {
  assert.equal(externalTarget('https://www.twitch.tv/kamet0'), 'https://www.twitch.tv/kamet0');
  assert.equal(externalTarget('http://example.com/'), 'http://example.com/');
});

test('refused links', () => {
  assert.equal(externalTarget('file:///C:/Windows/system32/cmd.exe'), null);
  assert.equal(externalTarget('javascript:alert(1)'), null);
  assert.equal(externalTarget('http://localhost/'), null);
  assert.equal(externalTarget('pas une url'), null);
});

test('Twitch pages allowed in the panel', async () => {
  const { isTwitchUrl } = await import('../src/main/navigation.js');
  assert.equal(isTwitchUrl('https://www.twitch.tv/kamet0/about'), true);
  assert.equal(isTwitchUrl('https://id.twitch.tv/oauth2/authorize'), true);
  assert.equal(isTwitchUrl('https://twitch.tv/'), true);
  assert.equal(isTwitchUrl('http://www.twitch.tv/'), false);
  assert.equal(isTwitchUrl('https://twitch.tv.evil.com/'), false);
  assert.equal(isTwitchUrl('https://eviltwitch.tv/'), false);
  assert.equal(isTwitchUrl('file:///C:/'), false);
});

test('permissions: refused by default', async () => {
  const { isAllowedPermission } = await import('../src/main/navigation.js');
  for (const p of ['fullscreen', 'clipboard-sanitized-write', 'storage-access', 'top-level-storage-access']) {
    assert.equal(isAllowedPermission(p), true, p);
  }
  for (const p of ['media', 'geolocation', 'notifications', 'openExternal', 'display-capture', 'midi', 'unknown']) {
    assert.equal(isAllowedPermission(p), false, p);
  }
});

test('Twitch panel: only the page itself leaving Twitch is blocked', async () => {
  const { blocksPanelNavigation } = await import('../src/main/navigation.js');
  assert.equal(blocksPanelNavigation({ url: 'https://evil.example/', isMainFrame: true }), true);
  assert.equal(blocksPanelNavigation({ url: 'https://www.twitch.tv/kamet0', isMainFrame: true }), false);
  assert.equal(blocksPanelNavigation({ url: 'https://ads.example/', isMainFrame: false }), false);
});

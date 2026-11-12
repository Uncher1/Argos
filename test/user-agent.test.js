import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromeUserAgent } from '../src/main/user-agent.js';

test('UA Chrome', () => {
  assert.equal(
    chromeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) argos/1.0.0 Chrome/140.0.0.0 Electron/45.1.0 Safari/537.36'),
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  );
});

test('upper case app name removed too', () => {
  assert.equal(chromeUserAgent('A Argos/1.0.0 Chrome/1 Electron/2 B'), 'A Chrome/1 B');
});

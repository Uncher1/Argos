import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitHeightBounds, windowModeSpec } from '../src/main/window-mode.js';

const work = { x: 0, y: 0, width: 1920, height: 1040 };

test('sign-in: card size, fixed', () => {
  assert.deepEqual(windowModeSpec('login', { width: 440, height: 331.6 }, work), {
    width: 440, height: 332, resizable: false, minWidth: 1, minHeight: 1,
  });
});

// 600 is only the starting height: the window then takes the height of the Twitch page.
test('Twitch panel: 480x600 at first, fixed', () => {
  assert.deepEqual(windowModeSpec('auth', null, work), {
    width: 480, height: 600, resizable: false, minWidth: 1, minHeight: 1,
  });
});

test('Twitch panel on a small screen: bounded', () => {
  assert.equal(windowModeSpec('auth', null, { x: 0, y: 0, width: 1366, height: 560 }).height, 520);
});

test('app: 1280x720 resizable, minimum 800x450', () => {
  assert.deepEqual(windowModeSpec('main', null, work), {
    width: 1280, height: 720, resizable: true, minWidth: 800, minHeight: 450,
  });
});

test('unknown mode: app', () => {
  assert.equal(windowModeSpec('nimporte', null, work).resizable, true);
});

test('fit height: keeps the vertical center and the width', () => {
  const work = { x: 0, y: 0, width: 1366, height: 728 };
  assert.deepEqual(fitHeightBounds({ x: 100, y: 20, width: 480, height: 688 }, 540, work), { x: 100, y: 94, width: 480, height: 540 });
});

test('fit height: stays on screen', () => {
  const work = { x: 0, y: 0, width: 1366, height: 728 };
  assert.deepEqual(fitHeightBounds({ x: 100, y: 300, width: 480, height: 400 }, 2000, work), { x: 100, y: 40, width: 480, height: 688 });
  assert.deepEqual(fitHeightBounds({ x: 100, y: 0, width: 480, height: 200 }, 400, work), { x: 100, y: 0, width: 480, height: 400 });
});

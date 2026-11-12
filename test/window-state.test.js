import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBounds } from '../src/main/window-state.js';

const screens = [{ x: 0, y: 0, width: 1920, height: 1040 }];

test('valid position kept', () => {
  assert.deepEqual(
    sanitizeBounds({ x: 50, y: 60, width: 1000, height: 600, maximized: false }, screens),
    { x: 50, y: 60, width: 1000, height: 600, maximized: false },
  );
});

test('screen unplugged: centered again', () => {
  assert.deepEqual(
    sanitizeBounds({ x: 2500, y: 100, width: 1000, height: 600, maximized: true }, screens),
    { width: 1000, height: 600, maximized: true },
  );
});

test('barely visible: centered again', () => {
  assert.deepEqual(
    sanitizeBounds({ x: 1880, y: 100, width: 1000, height: 600, maximized: false }, screens),
    { width: 1000, height: 600, maximized: false },
  );
});

test('too small: minimum', () => {
  assert.deepEqual(
    sanitizeBounds({ x: 0, y: 0, width: 300, height: 200, maximized: false }, screens),
    { x: 0, y: 0, width: 800, height: 450, maximized: false },
  );
});

test('nothing saved', () => {
  assert.deepEqual(sanitizeBounds(null, screens), { width: 1280, height: 720, maximized: false });
});

test('broken values: defaults', () => {
  assert.deepEqual(sanitizeBounds({ x: 'a', width: null }, screens), { width: 1280, height: 720, maximized: false });
});

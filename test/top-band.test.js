import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTopBandVisible } from '../src/main/top-band.js';

const b = { x: 100, y: 100, width: 1280, height: 720 };

test('shows up when nearing the top', () => {
  assert.equal(nextTopBandVisible(false, { x: 500, y: 102 }, b), true);
  assert.equal(nextTopBandVisible(false, { x: 500, y: 160 }, b), true);
});
test('not lower', () => assert.equal(nextTopBandVisible(false, { x: 500, y: 170 }, b), false));
test('stays visible when moving a bit away', () => assert.equal(nextTopBandVisible(true, { x: 500, y: 200 }, b), true));
test('goes away when moving away', () => assert.equal(nextTopBandVisible(true, { x: 500, y: 215 }, b), false));
test('goes away outside the window', () => assert.equal(nextTopBandVisible(true, { x: 500, y: 90 }, b), false));
test('outside the width of the window', () => assert.equal(nextTopBandVisible(false, { x: 50, y: 102 }, b), false));

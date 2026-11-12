import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRects } from '../src/renderer/layout.js';
import { hitTestDrop, dropLabel } from '../src/renderer/drop.js';

const size = { width: 1920, height: 1080 };
const grid = { channels: ['a', 'b', 'c', 'd'], featured: false, featuredSide: 'left' };
const feat = { ...grid, featured: true };
const three = { channels: ['a', 'b', 'c'], featured: true, featuredSide: 'left' };
const two = { channels: ['a', 'b'], featured: false, featuredSide: 'left' };
const gridRects = computeRects(grid, size);
const featRects = computeRects(feat, size);

test('4 tiles: point in another tile', () => {
  assert.deepEqual(hitTestDrop(grid, gridRects, { x: 1500, y: 900 }, 0), { kind: 'slot', index: 3 });
});

test('on its own tile: null', () => {
  assert.equal(hitTestDrop(grid, gridRects, { x: 100, y: 100 }, 0), null);
});

test('outside everything: null', () => {
  assert.equal(hitTestDrop(grid, gridRects, { x: -5, y: -5 }, 0), null);
});

test('2 streams: swap', () => {
  assert.deepEqual(hitTestDrop(two, computeRects(two, size), { x: 1500, y: 500 }, 0), { kind: 'slot', index: 1 });
});

test('the big one onto the column: a single target', () => {
  assert.deepEqual(hitTestDrop(feat, featRects, { x: 1600, y: 100 }, 0), { kind: 'column' });
  assert.deepEqual(hitTestDrop(feat, featRects, { x: 1600, y: 1000 }, 0), { kind: 'column' });
  assert.equal(hitTestDrop(feat, featRects, { x: 300, y: 300 }, 0), null);
  assert.deepEqual(hitTestDrop(three, computeRects(three, size), { x: 1600, y: 900 }, 0), { kind: 'column' });
});

test('small ones between themselves in spotlight', () => {
  assert.deepEqual(hitTestDrop(feat, featRects, { x: 1600, y: 1000 }, 1), { kind: 'slot', index: 3 });
});

test('small one onto the big one', () => {
  assert.deepEqual(hitTestDrop(feat, featRects, { x: 300, y: 300 }, 2), { kind: 'slot', index: 0 });
});

test('labels', () => {
  assert.equal(dropLabel(feat, { kind: 'column' }), 'Drop here = move to the right');
  assert.equal(dropLabel({ ...feat, featuredSide: 'right' }, { kind: 'column' }), 'Drop here = move to the left');
  assert.equal(dropLabel(grid, { kind: 'slot', index: 1 }), 'Drop = swap');
});

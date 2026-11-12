import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitAspect, computeRects, columnRect } from '../src/renderer/layout.js';

function near(actual, expected) {
  for (const key of ['x', 'y', 'w', 'h']) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) < 0.01,
      `${key}: ${actual[key]} attendu ${expected[key]} (${JSON.stringify(actual)})`,
    );
  }
}

const S = (channels, o = {}) => ({ channels, featured: false, featuredSide: 'left', ...o });
const size = { width: 1920, height: 1080 };

test('fitAspect already fills 16:9', () => {
  near(fitAspect({ x: 0, y: 0, w: 1600, h: 900 }, 16 / 9), { x: 0, y: 0, w: 1600, h: 900 });
});

test('fitAspect tall area', () => {
  near(fitAspect({ x: 0, y: 0, w: 1000, h: 900 }, 16 / 9), { x: 0, y: 168.75, w: 1000, h: 562.5 });
});

test('fitAspect wide area', () => {
  near(fitAspect({ x: 10, y: 0, w: 2000, h: 900 }, 16 / 9), { x: 210, y: 0, w: 1600, h: 900 });
});

test('no stream', () => {
  assert.deepEqual(computeRects(S([]), size), []);
});

test('1 stream: the whole window', () => {
  const r = computeRects(S(['a']), size);
  assert.equal(r.length, 1);
  near(r[0].cell, { x: 0, y: 0, w: 1920, h: 1080 });
  near(r[0].video, { x: 0, y: 0, w: 1920, h: 1080 });
});

test('2 streams: side by side', () => {
  const r = computeRects(S(['a', 'b']), size);
  near(r[0].cell, { x: 0, y: 0, w: 959, h: 1080 });
  near(r[1].cell, { x: 961, y: 0, w: 959, h: 1080 });
  near(r[1].video, { x: 961, y: 270.28, w: 959, h: 539.44 });
});

test('3 streams: big on the left, 2 stacked', () => {
  const r = computeRects(S(['a', 'b', 'c'], { featured: true }), size);
  near(r[0].cell, { x: 0, y: 0, w: 1278.67, h: 1080 });
  near(r[1].cell, { x: 1280.67, y: 0, w: 639.33, h: 539 });
  near(r[2].cell, { x: 1280.67, y: 541, w: 639.33, h: 539 });
  // The two small ones are stacked against each other, centered as a block.
  near(r[1].video, { x: 1280.67, y: 179.37, w: 639.33, h: 359.63 });
  near(r[2].video, { x: 1280.67, y: 541, w: 639.33, h: 359.63 });
});

test('4 streams in equal tiles', () => {
  const r = computeRects(S(['a', 'b', 'c', 'd']), size);
  near(r[0].cell, { x: 0, y: 0, w: 959, h: 539 });
  near(r[3].cell, { x: 961, y: 541, w: 959, h: 539 });
});

test('4 streams, spotlight on the left', () => {
  const r = computeRects(S(['a', 'b', 'c', 'd'], { featured: true }), size);
  near(r[0].cell, { x: 0, y: 0, w: 1280.37, h: 1080 });
  near(r[1].cell, { x: 1282.37, y: 0, w: 637.63, h: 358.67 });
  near(r[2].cell, { x: 1282.37, y: 360.67, w: 637.63, h: 358.67 });
  near(r[3].cell, { x: 1282.37, y: 721.33, w: 637.63, h: 358.67 });
  near(r[1].video, r[1].cell);
  near(r[0].video, { x: 0, y: 179.9, w: 1280.37, h: 720.2 });
});

test('spotlight on the right', () => {
  const r = computeRects(S(['a', 'b', 'c', 'd'], { featured: true, featuredSide: 'right' }), size);
  near(r[0].cell, { x: 639.63, y: 0, w: 1280.37, h: 1080 });
  assert.ok(Math.abs(r[1].cell.x) < 0.01);
});

test('21:9: the big one fills', () => {
  const r = computeRects(S(['a', 'b', 'c', 'd'], { featured: true }), { width: 2560, height: 1080 });
  near(r[0].video, { x: 0.19, y: 0, w: 1920, h: 1080 });
});

test('tiny window: no negative or NaN', () => {
  const states = [S(['a']), S(['a', 'b']), S(['a', 'b', 'c'], { featured: true }), S(['a', 'b', 'c', 'd']), S(['a', 'b', 'c', 'd'], { featured: true })];
  for (const sz of [{ width: 10, height: 10 }, { width: 0, height: 0 }]) {
    for (const st of states) {
      for (const { cell, video } of computeRects(st, sz)) {
        for (const v of [...Object.values(cell), ...Object.values(video)]) {
          assert.ok(Number.isFinite(v) && v >= 0, `valeur invalide ${v}`);
        }
      }
    }
  }
});

test('columnRect', () => {
  const st = S(['a', 'b', 'c', 'd'], { featured: true });
  near(columnRect(st, computeRects(st, size)), { x: 1282.37, y: 0, w: 637.63, h: 1080 });
  const three = S(['a', 'b', 'c'], { featured: true });
  near(columnRect(three, computeRects(three, size)), { x: 1280.67, y: 0, w: 639.33, h: 1080 });
  assert.equal(columnRect(S(['a', 'b']), computeRects(S(['a', 'b']), size)), null);
});

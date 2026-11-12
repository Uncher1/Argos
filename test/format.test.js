import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatViewers, thumbnailUrl } from '../src/renderer/format.js';

test('viewer counts are short, in the local format', () => {
  assert.equal(formatViewers(980, 'en'), '980');
  assert.equal(formatViewers(1000, 'en'), '1K');
  assert.equal(formatViewers(12400, 'en'), '12.4K');
  assert.equal(formatViewers(1250000, 'en'), '1.3M');
  assert.match(formatViewers(12400, 'fr'), /^12,4\s?k$/u);
});

test('thumbnail size is filled in', () => {
  assert.equal(thumbnailUrl('https://x/{width}x{height}.jpg', 440, 248), 'https://x/440x248.jpg');
});

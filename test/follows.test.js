import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offlineFollows } from '../src/renderer/follows.js';

const f = (login, name = login) => ({ id: 'id-' + login, login, name });

test('offline follows: those not live, in alphabetical order', () => {
  const followed = [f('squeezie', 'Squeezie'), f('amaury_yt', 'Amaury_yt'), f('doigby', 'Doigby'), f('blitzstream', 'BlitzStream')];
  const live = new Set(['doigby']);
  assert.deepEqual(offlineFollows(followed, live).map((c) => c.name), ['Amaury_yt', 'BlitzStream', 'Squeezie']);
});

test('offline follows: order ignores case and accents', () => {
  const followed = [f('b', 'bob'), f('e', 'Étienne'), f('a', 'Alice'), f('z', 'zoé')];
  assert.deepEqual(offlineFollows(followed, new Set()).map((c) => c.name), ['Alice', 'bob', 'Étienne', 'zoé']);
});

test('offline follows: no follows', () => {
  assert.deepEqual(offlineFollows([], new Set(['x'])), []);
});

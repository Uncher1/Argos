import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChannel, createState, feature, restoreState } from '../src/renderer/state.js';

test('the streams on screen come back after a language change', () => {
  let state = createState();
  for (const login of ['a', 'b', 'c', 'd']) state = addChannel(state, login).state;
  state = feature(state, 2);
  assert.deepEqual(restoreState(JSON.stringify(state)), state);
});

test('nothing usable saved: no state', () => {
  assert.equal(restoreState(null), null);
  assert.equal(restoreState('{oops'), null);
  assert.equal(restoreState(JSON.stringify({ channels: 'a' })), null);
  assert.equal(restoreState(JSON.stringify({ channels: ['a', 'b', 'c', 'd', 'e'] })), null);
  assert.equal(restoreState(JSON.stringify({ channels: [42] })), null);
});

test('missing details get their default values', () => {
  const state = restoreState(JSON.stringify({ channels: ['Squeezie'] }));
  assert.deepEqual(state.channels, ['squeezie']);
  assert.equal(state.featured, false);
  assert.equal(state.featuredSide, 'left');
});

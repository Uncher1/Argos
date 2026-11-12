import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, addChannel, toggleChannel, replaceAt, removeAt, feature, unfeature,
  swap, resolveDrop, indexOf, isFull, count, canFeature,
} from '../src/renderer/state.js';

const fill = (...logins) => logins.reduce((s, l) => addChannel(s, l).state, createState());

test('adds in order, 4 at most', () => {
  let s = createState();
  for (const [i, l] of ['A', 'b', 'c', 'd'].entries()) {
    const r = addChannel(s, l);
    assert.equal(r.index, i);
    s = r.state;
  }
  assert.equal(count(s), 4);
  assert.equal(isFull(s), true);
  assert.equal(addChannel(s, 'e').full, true);
});

test('duplicate: nothing changes', () => {
  const s = fill('a');
  const r = addChannel(s, 'A');
  assert.equal(r.index, 0);
  assert.deepEqual(r.state.channels, ['a']);
});

test('1 or 2 streams: never a spotlight', () => {
  assert.equal(fill('a').featured, false);
  assert.equal(fill('a', 'b').featured, false);
  assert.equal(feature(fill('a', 'b'), 1).featured, false);
  assert.equal(canFeature(fill('a', 'b')), false);
});

test('3 streams: the first chosen is in the spotlight', () => {
  const s = fill('a', 'b', 'c');
  assert.equal(s.featured, true);
  assert.deepEqual(s.channels, ['a', 'b', 'c']);
  assert.equal(canFeature(s), true);
});

test('3 streams: the first chosen, even after a swap', () => {
  const swapped = swap(fill('a', 'b'), 0, 1);
  assert.deepEqual(swapped.channels, ['b', 'a']);
  const s = addChannel(swapped, 'c').state;
  assert.equal(s.featured, true);
  assert.equal(s.channels[0], 'a');
});

test('3 streams: spotlight a small one', () => {
  const s = feature(fill('a', 'b', 'c'), 2);
  assert.deepEqual(s.channels, ['c', 'a', 'b']);
  assert.equal(s.featured, true);
});

test('3 streams: cannot go back to equal tiles', () => {
  assert.equal(unfeature(fill('a', 'b', 'c')).featured, true);
});

test('going to 4: the automatic spotlight of 3 streams goes away (4 equal tiles)', () => {
  const s = addChannel(fill('a', 'b', 'c'), 'd').state;
  assert.equal(s.featured, false);
  assert.deepEqual(s.channels, ['a', 'b', 'c', 'd']);
});

test('going to 4: a spotlight chosen from the menu is kept, then can be removed', () => {
  const s = addChannel(feature(fill('a', 'b', 'c'), 2), 'd').state;
  assert.equal(s.featured, true);
  assert.deepEqual(s.channels, ['c', 'a', 'b', 'd']);
  assert.equal(unfeature(s).featured, false);
});

test('chosen at 4, then back to 4 through 3: still kept', () => {
  const s = feature(fill('a', 'b', 'c', 'd'), 1);
  const back = addChannel(removeAt(s, 3), 'e').state;
  assert.equal(back.featured, true);
  assert.equal(back.channels[0], 'b');
});

test('back to equal tiles, then 3, then 4: the spotlight is automatic again', () => {
  const grid = unfeature(feature(fill('a', 'b', 'c', 'd'), 1));
  const back = addChannel(removeAt(grid, 3), 'e').state;
  assert.equal(back.featured, false);
});

test('dragging the big one or swapping at 3 is not a choice', () => {
  const three = resolveDrop(swap(fill('a', 'b', 'c'), 1, 2), 0, { kind: 'column' });
  assert.equal(addChannel(three, 'd').state.featured, false);
});

test('4 in equal tiles: the spotlight puts the stream first, on the left', () => {
  const grid = unfeature(fill('a', 'b', 'c', 'd'));
  const s = feature({ ...grid, featuredSide: 'right' }, 3);
  assert.deepEqual(s.channels, ['d', 'a', 'b', 'c']);
  assert.equal(s.featured, true);
  assert.equal(s.featuredSide, 'left');
});

test('removing the big one at 4: the first chosen of the 3 left gets the spotlight', () => {
  const s = feature(unfeature(fill('a', 'b', 'c', 'd')), 2);
  assert.deepEqual(s.channels, ['c', 'a', 'b', 'd']);
  const r = removeAt(s, 0);
  assert.deepEqual(r.channels, ['a', 'b', 'd']);
  assert.equal(r.featured, true);
});

test('removing a small one at 4: the big one stays', () => {
  const s = feature(unfeature(fill('a', 'b', 'c', 'd')), 2);
  const r = removeAt(s, 3);
  assert.deepEqual(r.channels, ['c', 'a', 'b']);
  assert.equal(r.featured, true);
});

test('4 in equal tiles then a removal: 3 with the first chosen in the spotlight', () => {
  const r = removeAt(unfeature(fill('a', 'b', 'c', 'd')), 0);
  assert.deepEqual(r.channels, ['b', 'c', 'd']);
  assert.equal(r.featured, true);
});

test('going to 2: no more spotlight', () => {
  const r = removeAt(fill('a', 'b', 'c'), 1);
  assert.deepEqual(r.channels, ['a', 'c']);
  assert.equal(r.featured, false);
});

test('toggle adds then removes', () => {
  const added = toggleChannel(createState(), 'a');
  assert.equal(added.action, 'added');
  const removed = toggleChannel(added.state, 'a');
  assert.equal(removed.action, 'removed');
  assert.deepEqual(removed.state.channels, []);
  assert.equal(toggleChannel(fill('a', 'b', 'c', 'd'), 'e').action, 'full');
});

test('replacing keeps the place and the spotlight', () => {
  const s = feature(fill('a', 'b', 'c', 'd'), 0);
  const r = replaceAt(s, 0, 'E');
  assert.deepEqual(r.channels, ['e', 'b', 'c', 'd']);
  assert.equal(r.featured, true);
  assert.equal(replaceAt(s, 1, 'c'), s);
});

test('the replacement counts as the last chosen', () => {
  const s = replaceAt(fill('a', 'b', 'c', 'd'), 0, 'e');
  // e was picked last: with b removed, c is the earliest of the three left.
  assert.deepEqual(removeAt(unfeature(s), 1).channels, ['c', 'e', 'd']);
  assert.deepEqual(removeAt(unfeature(s), 0).channels, ['b', 'c', 'd']);
});

test('swap', () => {
  assert.deepEqual(swap(fill('a', 'b'), 0, 1).channels, ['b', 'a']);
  const s = fill('a', 'b');
  assert.equal(swap(s, 1, 1), s);
});

test('dragging the big one onto the column: switches sides', () => {
  assert.equal(resolveDrop(fill('a', 'b', 'c'), 0, { kind: 'column' }).featuredSide, 'right');
});

test('dragging a small one onto the big one: it becomes the big one', () => {
  const r = resolveDrop(fill('a', 'b', 'c'), 2, { kind: 'slot', index: 0 });
  assert.deepEqual(r.channels, ['c', 'b', 'a']);
  assert.equal(r.featured, true);
});

test('indexOf and immutability', () => {
  const s = fill('a', 'b');
  assert.equal(indexOf(s, 'B'), 1);
  assert.equal(indexOf(s, 'z'), -1);
  removeAt(s, 0);
  swap(s, 0, 1);
  assert.deepEqual(s.channels, ['a', 'b']);
});

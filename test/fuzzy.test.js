import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, similarity, rankByName, typoQueries } from '../src/renderer/fuzzy.js';

test('normalize: lower case, no accents or separators', () => {
  assert.equal(normalize('Kameto_Like'), 'kametolike');
  assert.equal(normalize('Chaîne É 2'), 'chainee2');
});

test('same name or start of the name: very close', () => {
  assert.equal(similarity('kameto', 'Kameto'), 1);
  assert.ok(similarity('kame', 'kameto_like') >= 0.9);
});

test('typos: close', () => {
  assert.ok(similarity('kammeto', 'kameto_like') >= 0.7);
  assert.ok(similarity('jameto', 'kameto') >= 0.8);
  assert.ok(similarity('valoarnt', 'Valorant') >= 0.7);
  assert.ok(similarity('squezie', 'Squeezie') >= 0.8);
});

test('unrelated: far', () => {
  assert.ok(similarity('kameto', 'minecraft') < 0.5);
  assert.ok(similarity('zz', 'squeezie') < 0.5);
});

test('closest ranked first, below the threshold left out', () => {
  const items = [{ name: 'Minecraft' }, { name: 'Kameto' }, { name: 'Kamet0' }, { name: 'Gotaga' }];
  const ranked = rankByName('kammeto', items, (i) => [i.name]);
  assert.deepEqual(ranked.map((i) => i.name), ['Kameto', 'Kamet0']);
});

test('fallback queries to find a mistyped name', () => {
  assert.deepEqual(typoQueries('kammeto'), ['kammet', 'kamme', 'kamm', 'kam', 'ammeto']);
  assert.deepEqual(typoQueries('abc'), ['ab']);
  assert.deepEqual(typoQueries('a'), []);
});

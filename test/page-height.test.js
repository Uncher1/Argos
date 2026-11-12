import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measurePageHeight, createHeightSettler, MEASURE_PAGE_SCRIPT } from '../src/main/page-height.js';

// Minimal DOM: elements with a box, a parent and an optional scroll.
function node(tagName, box, { children = [], scrollTop = 0, hidden = false } = {}) {
  const el = { tagName, children, scrollTop, hidden, parentElement: null, getBoundingClientRect: () => box };
  children.forEach((c) => { c.parentElement = el; });
  return el;
}
const box = (top, height, width = 100) => ({ top, bottom: top + height, height, width });

function page(root) {
  const all = [];
  const walk = (el) => el.children.forEach((c) => { all.push(c); walk(c); });
  walk(root);
  const doc = { body: { querySelectorAll: () => all } };
  const win = { getComputedStyle: (el) => ({ visibility: el.hidden ? 'hidden' : 'visible' }) };
  return { doc, win };
}

test('height: bottom of the lowest visible content, plus a margin', () => {
  const root = node('BODY', box(0, 689), { children: [
    node('DIV', box(0, 689), { children: [node('H2', box(20, 30)), node('BUTTON', box(440, 39), { children: [node('DIV', box(445, 20))] })] }),
  ] });
  const { doc, win } = page(root);
  assert.equal(measurePageHeight(doc, win), 495);
});

test('height: ignores what is hidden or has no size', () => {
  const root = node('BODY', box(0, 689), { children: [
    node('P', box(10, 20)), node('SPAN', box(600, 20), { hidden: true }), node('I', box(650, 0)), node('B', box(650, 10, 0)),
  ] });
  const { doc, win } = page(root);
  assert.equal(measurePageHeight(doc, win), 46);
});

test('height: counts content scrolled out of the window', () => {
  const root = node('BODY', box(0, 300), { children: [node('DIV', box(0, 300), { scrollTop: 200, children: [node('P', box(250, 50))] })] });
  const { doc, win } = page(root);
  assert.equal(measurePageHeight(doc, win), 516);
});

test('height: empty page (loading) = 0', () => {
  const { doc, win } = page(node('BODY', box(0, 0)));
  assert.equal(measurePageHeight(doc, win), 0);
});

test('stable measure: given after two equal measures, only once', () => {
  const settle = createHeightSettler();
  assert.equal(settle(500), null);
  assert.equal(settle(500), 500);
  assert.equal(settle(500), null);
  assert.equal(settle(620), null);
  assert.equal(settle(620), 620);
});

test('stable measure: ignores small gaps and loading pages', () => {
  const settle = createHeightSettler();
  settle(500);
  settle(500);
  assert.equal(settle(503), null);
  assert.equal(settle(503), null);
  assert.equal(settle(0), null);
  assert.equal(settle(0), null);
});

test('self-contained injectable measuring script', () => {
  assert.match(MEASURE_PAGE_SCRIPT, /^\(/);
  assert.doesNotThrow(() => new Function(MEASURE_PAGE_SCRIPT));
});

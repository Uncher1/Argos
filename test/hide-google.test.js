import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hideGoogleButtons, HIDE_GOOGLE_SCRIPT } from '../src/main/hide-google.js';

const button = (text) => ({ textContent: text, style: { display: '' } });

function fakePage(buttons) {
  const observers = [];
  const doc = { documentElement: {}, querySelectorAll: (sel) => (sel === 'button' ? buttons : []) };
  class Observer {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
  }
  return { doc, Observer, changed: () => observers.forEach((o) => o.cb()) };
}

test('hides the Google button of the Twitch sign-in page, keeps the others', () => {
  const buttons = [button('Se connecter'), button('Continuer avec Google'), button('Continuer avec Apple')];
  const page = fakePage(buttons);
  hideGoogleButtons(page.doc, page.Observer);
  assert.deepEqual(buttons.map((b) => b.style.display), ['', 'none', '']);
});

test('also hides a Google button that shows up later (page changes)', () => {
  const buttons = [button('Se connecter')];
  const page = fakePage(buttons);
  hideGoogleButtons(page.doc, page.Observer);
  buttons.push(button('Continue with Google'));
  page.changed();
  assert.equal(buttons[1].style.display, 'none');
});

test('self-contained injectable script', () => {
  assert.match(HIDE_GOOGLE_SCRIPT, /^\(/);
  assert.doesNotThrow(() => new Function(HIDE_GOOGLE_SCRIPT));
});

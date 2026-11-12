import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installDemo } from '../dev/demo.js';

// The API the real preload gives to the page, read without Electron.
function realApi() {
  let api;
  const electron = {
    contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } },
    ipcRenderer: { invoke: async () => {}, send: () => {}, on: () => {}, removeListener: () => {} },
  };
  const source = readFileSync(new URL('../src/preload/preload.cjs', import.meta.url), 'utf8');
  vm.runInNewContext(source, { require: () => electron });
  return api;
}

test('the demo mode gives the whole sign-in API of the real preload', () => {
  const real = realApi();
  const element = () => ({ append() {} });
  globalThis.document = { createElement: element, head: element(), body: element() };
  try {
    const { argos } = installDemo(real);
    const missing = Object.keys(real.login).filter((key) => typeof argos.login[key] !== 'function');
    assert.deepEqual(missing, []);
  } finally {
    delete globalThis.document;
  }
});

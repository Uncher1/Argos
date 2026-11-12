import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, saveSettings } from '../src/main/settings.js';

const tempFile = () => {
  const dir = mkdtempSync(join(tmpdir(), 'argos-settings-'));
  return { file: join(dir, 'settings.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

test('nothing saved yet: no language', () => {
  const { file, cleanup } = tempFile();
  assert.deepEqual(loadSettings(file), { language: null });
  cleanup();
});

test('the chosen language is saved and read back', () => {
  const { file, cleanup } = tempFile();
  saveSettings(file, { language: 'ja' });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { language: 'ja' });
  assert.deepEqual(loadSettings(file), { language: 'ja' });
  cleanup();
});

test('a broken file or an unknown language is ignored', () => {
  const { file, cleanup } = tempFile();
  writeFileSync(file, '{oops');
  assert.deepEqual(loadSettings(file), { language: null });
  writeFileSync(file, JSON.stringify({ language: 'klingon' }));
  assert.deepEqual(loadSettings(file), { language: null });
  cleanup();
});

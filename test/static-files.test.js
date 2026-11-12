import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { resolveStaticPath, contentTypeFor } from '../src/main/static-files.js';

const root = join(process.cwd(), 'src', 'renderer');

test('root to index.html', () => {
  assert.equal(resolveStaticPath(root, '/'), join(root, 'index.html'));
});

test('nested file', () => {
  assert.equal(resolveStaticPath(root, '/styles/base.css'), join(root, 'styles', 'base.css'));
});

test('going up is forbidden', () => {
  assert.equal(resolveStaticPath(root, '/../main/main.js'), null);
  assert.equal(resolveStaticPath(root, '/%2e%2e/main/main.js'), null);
});

test('types', () => {
  assert.equal(contentTypeFor('a.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('a.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('a.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('a.svg'), 'image/svg+xml');
  assert.equal(contentTypeFor('a.bin'), 'application/octet-stream');
});

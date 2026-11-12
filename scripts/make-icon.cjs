// Renders build/icon.svg to build/icon.png (256x256) with Electron itself.
// Usage: npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const buildDir = join(__dirname, '..', 'build');

app.whenReady().then(async () => {
  const svg = readFileSync(join(buildDir, 'icon.svg'), 'utf8');
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  writeFileSync(join(buildDir, 'icon.png'), image.resize({ width: 256, height: 256 }).toPNG());
  console.log('build/icon.png written');
  app.quit();
});

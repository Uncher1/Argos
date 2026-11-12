import { readFileSync, writeFileSync } from 'node:fs';
import { isSupported } from '../renderer/i18n/languages.js';

// The user's settings, kept next to the session: for now, the language.
export function loadSettings(file) {
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    return { language: isSupported(saved?.language) ? saved.language : null };
  } catch {
    return { language: null };
  }
}

export function saveSettings(file, settings) {
  writeFileSync(file, JSON.stringify({ language: settings.language }));
}

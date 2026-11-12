import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadConfig(appRoot) {
  try {
    const raw = JSON.parse(readFileSync(join(appRoot, 'config', 'twitch.json'), 'utf8'));
    const clientId = typeof raw.clientId === 'string' ? raw.clientId.trim() : '';
    return { clientId: clientId && !clientId.startsWith('colle-ici') ? clientId : null };
  } catch {
    return { clientId: null };
  }
}

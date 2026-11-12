import { readFileSync, rmSync, writeFileSync } from 'node:fs';

// Keeps { token, userId, login } on disk, encrypted with the OS keychain when available.
export function createTokenStore(filePath, safeStorage) {
  const encrypted = () => safeStorage.isEncryptionAvailable();
  return {
    load() {
      try {
        const data = readFileSync(filePath);
        const text = encrypted() ? safeStorage.decryptString(data) : data.toString('utf8');
        const session = JSON.parse(text);
        return session?.token ? session : null;
      } catch {
        return null;
      }
    },
    save(session) {
      const text = JSON.stringify(session);
      writeFileSync(filePath, encrypted() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8'));
    },
    clear() {
      rmSync(filePath, { force: true });
    },
  };
}

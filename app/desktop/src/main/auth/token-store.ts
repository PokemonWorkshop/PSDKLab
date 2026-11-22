import type { StoredAuth, TokenStore } from '@psdk-lab/core';
import { app, safeStorage } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** System encryption. Linux without a keyring ("basic_text"): memory only. */
async function canEncrypt(): Promise<boolean> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
  if (process.platform !== 'linux') return true;
  return safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

/** The GitLab account, encrypted in <userData>/auth/. Main process only. */
export function electronTokenStore(): TokenStore {
  const file = join(app.getPath('userData'), 'auth', 'gitlab.bin');
  let persistent: Promise<boolean> | null = null;
  let memory: StoredAuth | null = null;
  const isPersistent = () => (persistent ??= canEncrypt());

  const save = async (auth: StoredAuth) => {
    memory = auth;
    if (!(await isPersistent())) return;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await safeStorage.encryptStringAsync(JSON.stringify(auth)));
  };

  return {
    isPersistent,
    save,
    async load() {
      if (!(await isPersistent())) return memory;
      try {
        const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
          await readFile(file),
        );
        const auth = JSON.parse(result) as StoredAuth;
        if (shouldReEncrypt) await save(auth);
        return auth;
      } catch {
        return null; // none yet, or encrypted by another system account
      }
    },
    async clear() {
      memory = null;
      await rm(file, { force: true });
    },
  };
}

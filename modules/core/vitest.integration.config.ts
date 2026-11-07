import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.it.test.ts'], testTimeout: 20 * 60_000 },
});

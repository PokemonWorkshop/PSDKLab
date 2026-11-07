import { defineConfig } from 'vitest/config';

// Unit tests only: integration tests (*.it.test.ts) hit the network and run
// with `npm run test:integration`.
export default defineConfig({
  test: { exclude: ['**/node_modules/**', '**/*.it.test.ts'] },
});

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Core is bundled (otherwise main crashes at runtime: unbuilt TS source).
const bundleCore = externalizeDepsPlugin({ exclude: ['@psdk-lab/core'] });

export default defineConfig({
  main: { plugins: [bundleCore] },
  preload: { plugins: [bundleCore] },
  renderer: { plugins: [react()] },
});

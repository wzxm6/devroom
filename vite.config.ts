import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  test: {
    // Playwright specs live under tests/e2e and run via `npx playwright test`,
    // never under Vitest.
    exclude: ['tests/e2e/**', 'node_modules', 'dist'],
  },
});

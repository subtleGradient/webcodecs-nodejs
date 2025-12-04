import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Exclude native-* tests in browser - they require Node.js N-API addon
    exclude: ['tests/native-*.test.ts', 'node_modules/**'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' }
      ]
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/native-*.test.ts'],  // Skip our native addon tests
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup-node-webcodecs.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});

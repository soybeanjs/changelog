import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts']
    }
  }
});

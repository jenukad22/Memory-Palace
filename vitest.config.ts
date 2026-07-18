import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/engine/**/*.test.ts', 'src/db/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/db/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts', 'src/db/**/*.test.ts', 'src/db/migrations.generated.ts'],
    },
  },
});

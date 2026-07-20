// Import URL from node:url (not the global) so it stays Node's URL even when a
// dependency's types pull the DOM lib into the program (e.g. sql.js/expo on the
// web client). Otherwise the global DOM `URL` mismatches node's fileURLToPath.
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/engine/**/*.test.ts',
      'src/db/**/*.test.ts',
      'src/ui/**/*.test.ts',
      'src/assessment/**/*.test.ts',
      'src/modules/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/engine/**/*.ts',
        'src/db/**/*.ts',
        'src/ui/**/*.ts',
        'src/assessment/**/*.ts',
        'src/modules/**/*.ts',
      ],
      exclude: [
        'src/engine/**/*.test.ts',
        'src/db/**/*.test.ts',
        'src/ui/**/*.test.ts',
        'src/assessment/**/*.test.ts',
        'src/modules/**/*.test.ts',
        'src/db/migrations.generated.ts',
      ],
    },
  },
});

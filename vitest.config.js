import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['index.js', 'src/**/*.js'],
      exclude: [
        'cli/**',
        'dist/**',
        'scaffold/**',
        'tests/**',
        'zquery-website/**',
      ],
      reporter: ['text', 'json-summary', 'json'],
      thresholds: {
        statements: 90,
        lines: 90,
      },
    },
    benchmark: {
      include: ['tests/**/*.bench.js'],
    },
  },
});

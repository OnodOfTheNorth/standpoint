import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/cli/test/**/*.test.ts', 'apps/mcp/test/**/*.test.ts'],
    testTimeout: 60000,
  },
});

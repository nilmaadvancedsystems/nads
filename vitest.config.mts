import { defineConfig } from 'vitest/config';

// Testes do nads: regras do core no Node; hooks/telas com jsdom (marcar o arquivo com
// "// @vitest-environment jsdom").
export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

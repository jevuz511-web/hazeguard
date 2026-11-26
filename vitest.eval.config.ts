// Live evaluation against the real Gemini API; needs GEMINI_API_KEY and is never part of CI.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/live/**/*.eval.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});

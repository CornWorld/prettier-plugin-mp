import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/plugin-xml/**',
      '**/.{idea,git,cache,output,temp}/**'
    ]
  }
});
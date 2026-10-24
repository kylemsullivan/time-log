import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{js,jsx}', 'tests/integration/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
  },
});

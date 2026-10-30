import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site under /overlap/. The Docker build sets VITE_BASE=/ .
export default defineConfig({
  base: process.env.VITE_BASE || '/overlap/',
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

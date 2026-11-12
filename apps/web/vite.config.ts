import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: process.env.STANDPOINT_BASE ?? '/standpoint/',
  plugins: [preact()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  resolve: { alias: { 'node:process': 'process' } },
});

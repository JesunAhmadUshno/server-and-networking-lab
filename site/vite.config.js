import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The site reads src/, experiments/, results/, tests/ and the docs at build time, so every number on the page is generated, never typed.
export default defineConfig({
  base: '/server-and-networking-lab/',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const apiPort = Number(process.env.CVTOOL_PORT ?? 3000);
const vitePort = Number(process.env.CVTOOL_VITE_PORT ?? 5173);

export default defineConfig({
  root: path.join(root, 'src', 'web'),
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: vitePort,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.join(root, 'dist', 'web'),
    emptyOutDir: true,
    target: 'es2022',
  },
});

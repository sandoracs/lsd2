import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lsd2/protocol': resolve(__dirname, '../protocol/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
});

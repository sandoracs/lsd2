import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import basicSsl from '@vitejs/plugin-basic-ssl';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lsd2/protocol': resolve(__dirname, '../protocol/src/index.ts'),
    },
  },
  // HTTPS always on — getUserMedia requires a secure origin on mobile
  plugins: [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});

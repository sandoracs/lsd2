import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const useHttps = process.env.HTTPS === 'true';

export default defineConfig(async () => {
  const plugins = useHttps
    ? [(await import('@vitejs/plugin-basic-ssl')).default()]
    : [];

  return {
    resolve: {
      // Point directly at TS source — no pre-build step needed for this lib
      alias: {
        '@lsd2/protocol': resolve(__dirname, '../protocol/src/index.ts'),
      },
    },
    server: {
      host: '0.0.0.0', // Expose on LAN for mobile testing
      port: 5173,
    },
    plugins,
  };
});

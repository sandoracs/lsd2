import { defineWorkspace } from 'vitest/config';
import { fileURLToPath } from 'node:url';

function src(path: string) {
  return fileURLToPath(new URL(`./packages/${path}`, import.meta.url));
}

const protocol      = src('protocol/src/index.ts');
const colorMapping  = src('color-mapping/src/index.ts');

export default defineWorkspace([
  {
    test: {
      name: 'color-mapping',
      include: ['packages/color-mapping/src/__tests__/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: { '@lsd2/protocol': protocol } },
  },
  {
    test: {
      name: 'capture-client',
      include: ['packages/capture-client/src/__tests__/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: { '@lsd2/protocol': protocol } },
  },
  {
    test: {
      name: 'server',
      include: ['packages/server/src/__tests__/**/*.test.ts'],
      environment: 'node',
    },
    resolve: {
      alias: {
        '@lsd2/protocol':      protocol,
        '@lsd2/color-mapping': colorMapping,
      },
    },
  },
]);

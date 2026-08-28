// 🧪 apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Le dossier annonce 90 % sur les modules metier : le seuil est ici,
      // et la chaine d'integration echoue s'il n'est pas atteint.
      thresholds: { 'src/services/**': { statements: 90, branches: 85, functions: 90 } },
      reporter: ['text', 'html'],
    },
  },
});

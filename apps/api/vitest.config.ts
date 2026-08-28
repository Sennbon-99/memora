// apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // On ne mesure que ce qui porte des regles metier. Les routes ne sont
      // que du cablage, les fichiers de configuration ne contiennent aucune
      // decision : les inclure diluerait le chiffre sans rien garantir.
      include: [
        'src/features/**/*.service.ts',
        'src/features/publication/visibility.ts',
        'src/features/qrkit/qrkit.cards.ts',
        'src/utils/**/*.ts',
      ],
      // Le rendu PDF est du dessin : il se verifie sur le fichier produit,
      // pas par des assertions. Sa logique, elle, vit dans qrkit.cards.ts.
      exclude: ['src/utils/http.ts', 'src/features/qrkit/qrkit.service.ts'],
      // Le dossier annonce 90 % sur les modules metier : le seuil est ici,
      // et la chaine d'integration echoue s'il n'est pas atteint.
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});

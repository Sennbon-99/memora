// packages/types/src/index.ts
// Point d'entree unique du paquet partage. L'API et le client importent
// toujours depuis "@memora/types", jamais depuis un fichier interne.

// Effet de bord : installe les messages de validation en francais.
import './locale.js';

export * from './enums.js';
export * from './schemas.js';

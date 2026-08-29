// apps/api/prisma.config.ts
// Configuration de Prisma.
//
// Ce fichier remplace la cle "prisma" du package.json, depreciee depuis la
// version 6.19 et supprimee en version 7. Il resout surtout un piege reel :
// avec un schema decoupe en plusieurs fichiers, Prisma cherche le dossier
// des migrations a cote du dossier de schema, donc dans prisma/schema/migrations.
// Sans le chemin declare ici, la commande annonce "no migration found" et
// applique un schema vide sans se plaindre.

// A partir d'un fichier de configuration, Prisma ne lit plus le .env tout
// seul : c'est a nous de le charger, et avant tout le reste.
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});

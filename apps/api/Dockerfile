# apps/api/Dockerfile
# Construction en plusieurs etapes : l'image finale ne contient que ce qui
# sert a l'execution. Les outils de compilation, les sources TypeScript et
# les dependances de developpement restent dans l'etape de build.

# --- Etape 1 : dependances -------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable

# On copie d'abord les manifestes seuls : tant qu'ils ne changent pas, Docker
# reutilise cette couche et l'installation n'est pas rejouee a chaque commit.
# Tous les manifestes de l'espace de travail, y compris ceux dont cette
# image n'a pas besoin. Sans eux, pnpm install --frozen-lockfile travaille
# sur un espace incomplet : il ne remonte aucune erreur, mais certaines
# dependances ne sont pas installees. C'est ainsi que prisma manquait a
# l'etape suivante, avec pour seul indice « prisma: not found ».
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# --prod=false est explicite et non redondant : la plateforme de
# deploiement injecte les variables de l'application comme arguments de
# construction, dont NODE_ENV=production. pnpm omet alors les dependances
# de developpement — dont prisma, typescript et vite — et la construction
# echoue trois etapes plus loin sur un « prisma: not found » qui ne dit
# rien de sa cause.
RUN pnpm install --frozen-lockfile --prod=false

# --- Etape 2 : compilation -------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .
# Le client Prisma est genere avant la compilation : les types en dependent.
RUN pnpm --filter @memora/api db:generate
RUN pnpm --filter @memora/types build
RUN pnpm --filter @memora/api build

# --- Etape 3 : execution ---------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Utilisateur non privilegie : un processus compromis ne doit pas etre root.
RUN addgroup -S memora && adduser -S memora -G memora

# Avec pnpm, les dependances vivent a deux endroits : le magasin partage a
# la racine, et un dossier de liens propre a chaque paquet. Ne copier que
# la racine laisse une image qui se construit sans erreur et refuse de
# demarrer, sur un « Cannot find package socket.io » a l'execution.
COPY --from=build --chown=memora:memora /app/node_modules ./node_modules
COPY --from=build --chown=memora:memora /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=memora:memora /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=build --chown=memora:memora /app/packages/types/dist ./packages/types/dist
COPY --from=build --chown=memora:memora /app/packages/types/package.json ./packages/types/
COPY --from=build --chown=memora:memora /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=memora:memora /app/apps/api/generated ./apps/api/generated
COPY --from=build --chown=memora:memora /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=memora:memora /app/apps/api/package.json ./apps/api/
# La configuration de Prisma declare ou vit le schema. Sans elle, la
# commande de migration cherche prisma/schema.prisma, ne le trouve pas —
# le schema est decoupe en plusieurs fichiers — et refuse de s executer.
COPY --from=build --chown=memora:memora /app/apps/api/prisma.config.ts ./apps/api/

USER memora
WORKDIR /app/apps/api

# Cette etape s'arrete ici : ni port, ni sonde, ni commande. Elle porte ce
# que les deux processus partagent, et rien de ce qui les distingue. Une
# sonde posee ici serait heritee par le travailleur, qui n'ecoute sur aucun
# port : elle echouerait toutes les trente secondes sur un conteneur en
# parfaite sante.

# --- Etape 4 : le travailleur ----------------------------------------------
# Meme image que l'API, autre point d'entree. Une cible de construction
# plutot qu'un second Dockerfile : la recette d'execution — les trois
# dossiers node_modules que pnpm eparpille, l'utilisateur non privilegie, le
# client Prisma genere — ne doit vivre qu'a un seul endroit, sinon elle
# derive. Le fichier `Dockerfile.worker` qu'elle remplace partait de
# `FROM memora-api:latest`, une etiquette qui n'existe que sur une machine
# ayant deja construit l'API a la main : aucune plateforme de deploiement ne
# peut la resoudre, et le travailleur n'a donc jamais ete deployable.
#
# Le travailleur n'a volontairement aucune sonde. `HEALTHCHECK NONE` n'aurait
# pas convenu : l'instruction laisse une sonde declaree dans l'image, Coolify
# la voit, passe outre le reglage qui la desactive, et interroge un
# `.State.Health` que Docker ne renseigne jamais dans ce cas — le
# deploiement echoue sur un « template parsing error » qui ne dit rien de sa
# cause. L'absence d'instruction, elle, ne laisse aucune trace.
#
# Le conteneur reste malgre tout surveille : le processus est PID 1, s'il
# meurt le conteneur s'arrete, et l'hebergeur le redemarre.
FROM runtime AS worker

# Pas de migrations au demarrage, contrairement a l'API : c'est elle qui les
# applique, et `migrate deploy` prend un verrou consultatif que deux
# conteneurs demarrant ensemble se disputeraient pour rien.
CMD ["node", "dist/worker.js"]

# --- Etape 5 : l'API -------------------------------------------------------
# En dernier, donc construite par defaut : c'est la cible que prend une
# plateforme qui n'en precise aucune. Le travailleur, lui, se demande
# explicitement — `--target worker`.
FROM runtime AS api
EXPOSE 3000

# La sonde interroge la meme route que Coolify : si la base ou Redis ne
# repondent pas, le conteneur est declare malade et le trafic ne bascule pas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

COPY --from=build --chown=memora:memora /app/apps/api/docker-entrypoint.sh ./
CMD ["./docker-entrypoint.sh"]

# apps/web/Dockerfile
# Le client est une application statique : rien ne s'execute cote serveur
# une fois construit. L'image finale ne contient donc que les fichiers
# produits et un serveur web, sans Node ni dependances.

# --- Etape 1 : construction ------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# Tous les manifestes de l'espace de travail : voir la note du Dockerfile
# de l'API. Un espace incomplet produit une installation partielle et
# silencieuse.
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

COPY . .
RUN pnpm --filter @memora/types build
RUN pnpm --filter @memora/web build

# --- Etape 2 : diffusion ---------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Le modele est rempli au demarrage par envsubst : l'adresse de l'API
# depend du deploiement, pas de l'image. La meme image sert donc en
# preproduction et en production.
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

ENV API_UPSTREAM=http://memora-api:3000
EXPOSE 80

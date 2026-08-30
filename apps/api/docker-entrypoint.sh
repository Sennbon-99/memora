#!/bin/sh
# apps/api/docker-entrypoint.sh
# Applique les migrations puis demarre le serveur.
#
# La plateforme d'hebergement propose une commande de pre-deploiement, mais
# elle s'execute sur l'image PRECEDENTE, avant que la nouvelle soit
# construite : une migration livree avec du code neuf serait appliquee un
# deploiement trop tard, et le code tournerait entre-temps contre un schema
# qu'il ne connait pas. En passant par le demarrage du conteneur, le code et
# ses migrations ne peuvent plus se desynchroniser.
#
# migrate deploy prend un verrou consultatif : deux conteneurs qui demarrent
# ensemble ne rejouent pas la meme migration.
set -e

echo "Application des migrations en attente"
./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema

echo "Demarrage du serveur"
exec node dist/server.js

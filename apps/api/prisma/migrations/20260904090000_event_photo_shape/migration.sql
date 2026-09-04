-- Le cadrage de la prise de vue, choisi par l'organisateur a la creation.
-- Les evenements existants gardent le carre : c'est le rendu qu'ils ont
-- toujours produit, changer leur format en cours de route melangerait deux
-- formats dans une meme pellicule.
CREATE TYPE "PhotoShape" AS ENUM ('SQUARE', 'FULL');

ALTER TABLE "events" ADD COLUMN "photoShape" "PhotoShape" NOT NULL DEFAULT 'SQUARE';

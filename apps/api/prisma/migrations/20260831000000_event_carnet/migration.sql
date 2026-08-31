-- Le carnet de la soiree.
--
-- Les soirees existantes prennent celui de la marque plutot que celui de leur
-- type : un album deja publie ne doit pas changer d'apparence sous les yeux de
-- ceux a qui on en a envoye le lien. Seules les nouvelles soirees heritent du
-- carnet de leur type.
ALTER TABLE "events" ADD COLUMN "carnet" VARCHAR(32) NOT NULL DEFAULT 'papier';

-- La couleur libre n'est plus demandee a l'hote : le carnet porte l'accent, et
-- deux systemes de couleur concurrents ne peuvent pas garantir le contraste.
-- La colonne est conservee — la supprimer ici rendrait le retour arriere
-- impossible pour rien — mais elle recoit une valeur par defaut, sans quoi les
-- creations qui ne l'envoient plus seraient refusees par la base.
ALTER TABLE "events" ALTER COLUMN "color" SET DEFAULT '#c9a961';

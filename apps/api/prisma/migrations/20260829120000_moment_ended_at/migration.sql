-- Date de fermeture anticipee d'un moment fort.
--
-- Auparavant la cloture ramenait durationMinutes au temps ecoule, arrondi a
-- la minute superieure. Un moment ferme au bout de vingt secondes restait
-- donc annonce comme en cours pendant quarante secondes, et l'hote voyait
-- son geste sans effet.
ALTER TABLE "moments" ADD COLUMN "endedAt" TIMESTAMP(3);

-- Les moments deja clos gardent leur duree comme date de fin implicite.
UPDATE "moments"
SET "endedAt" = "startedAt" + ("durationMinutes" * interval '1 minute')
WHERE "startedAt" IS NOT NULL
  AND "startedAt" + ("durationMinutes" * interval '1 minute') < now();

-- Ajout de reviewedAt sur la pellicule.
--
-- Le tri se fait par acceptation tacite : une photographie non touchee est
-- conservee. Sans cette date, une pellicule entierement gardee serait
-- indiscernable d'une pellicule jamais ouverte, et l'hote ne saurait plus
-- ou il en est.
ALTER TABLE "rolls" ADD COLUMN "reviewedAt" TIMESTAMPTZ;

-- Les pellicules d'un evenement deja publie sont considerees comme triees.
UPDATE "rolls" SET "reviewedAt" = now()
WHERE "eventId" IN (SELECT "id" FROM "events" WHERE "state" = 'PUBLISHED');

CREATE INDEX "rolls_eventId_reviewedAt_idx" ON "rolls" ("eventId", "reviewedAt");

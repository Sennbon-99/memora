-- Code court affiche sous le QR code. Les evenements existants recoivent une
-- valeur stable ; les nouveaux utilisent un alphabet sans caracteres ambigus.
ALTER TABLE "events" ADD COLUMN "joinCode" VARCHAR(8);

UPDATE "events"
SET "joinCode" = UPPER(SUBSTRING(MD5("id") FROM 1 FOR 8));

ALTER TABLE "events" ALTER COLUMN "joinCode" SET NOT NULL;
CREATE UNIQUE INDEX "events_joinCode_key" ON "events"("joinCode");

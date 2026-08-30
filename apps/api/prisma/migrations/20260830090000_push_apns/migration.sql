-- Deux canaux de notification coexistent desormais : le Web Push du
-- navigateur et le service d'Apple pour l'application installee.
CREATE TYPE "PushKind" AS ENUM ('WEB', 'APNS');

ALTER TABLE "push_subscriptions"
  ADD COLUMN "kind" "PushKind" NOT NULL DEFAULT 'WEB';

-- Les cles de chiffrement n'existent que sur le canal Web Push : APNs
-- chiffre au niveau du transport et ne fournit qu'un jeton d'appareil.
ALTER TABLE "push_subscriptions" ALTER COLUMN "p256dh" DROP NOT NULL;
ALTER TABLE "push_subscriptions" ALTER COLUMN "auth" DROP NOT NULL;

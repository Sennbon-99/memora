// apps/web/src/features/guest/useShot.ts
// Prise d'une pose, de l'appui sur le declencheur jusqu'a la confirmation.
//
// Trois appels reseau se suivent, et l'ordre compte :
//   1. reserve  — le serveur decremente le quota et rend une adresse signee
//   2. PUT      — le fichier part vers le stockage, sans passer par l'API
//   3. confirm  — l'API apprend que le fichier est bien arrive
//
// Si le reseau tombe entre le 1 et le 2, la pose est mise en file locale et
// rejouee plus tard. La cle d'idempotence, generee ici avant le premier appel,
// garantit qu'un rejeu ne consomme pas une seconde pose.

import { useMutation } from '@tanstack/react-query';
import { isNetworkError, photoApi, uploadPhoto } from '../../lib/api.js';
import { prepare } from '../../lib/image.js';
import type { PreparedImage } from '../../lib/image.js';
import { enqueue, dequeue, markAttempt, pending, MAX_ATTEMPTS } from '../../lib/queue.js';
import { useUpdateSession } from './useGuestSession.js';

export interface ShotResult {
  idempotencyKey: string;
  previewBlob: Blob;
  /** Vrai si la pose attend le retour du reseau. */
  queued: boolean;
  fromBonus: boolean;
}

/**
 * Retire une pose du quota en cache : d'abord les poses offertes.
 * Meme ordre que le script Lua du serveur — sans cela, les deux decomptes
 * divergeraient au retour du reseau.
 */
export function spendLocally<T extends { shotsLeft: number; bonusShots: number }>(roll: T): T {
  return roll.bonusShots > 0
    ? { ...roll, bonusShots: roll.bonusShots - 1 }
    : { ...roll, shotsLeft: Math.max(0, roll.shotsLeft - 1) };
}

export function useShot(slug: string) {
  const update = useUpdateSession(slug);

  return useMutation<ShotResult, Error, ImageBitmap | PreparedImage>({
    mutationFn: async (frame) => {
      const { blob, width, height } = 'blob' in frame ? frame : await prepare(frame);
      const idempotencyKey = crypto.randomUUID();
      const takenAt = new Date().toISOString();

      try {
        const reservation = await photoApi.reserve({
          idempotencyKey,
          takenAt: new Date(takenAt),
          width,
          height,
          sizeBytes: blob.size,
        });

        await uploadPhoto(reservation.uploadUrl, blob);
        await photoApi.confirm(idempotencyKey);

        // Le serveur fait autorite sur le quota des qu'il repond.
        update((previous) => ({
          ...previous,
          roll: {
            ...previous.roll,
            shotsLeft: reservation.shotsLeft,
            bonusShots: reservation.bonusShots,
          },
        }));

        return { idempotencyKey, previewBlob: blob, queued: false, fromBonus: reservation.fromBonus };
      } catch (error) {
        // Un refus du serveur (quota epuise, evenement clos) doit remonter :
        // le rejouer ne changerait rien. Seule une panne reseau est mise en file.
        if (!isNetworkError(error)) throw error;

        await enqueue({ idempotencyKey, blob, takenAt, width, height, attempts: 0 });

        // Le compteur baisse quand meme : sinon l'invite croirait sa pose
        // perdue et la reprendrait, consommant deux poses pour une image.
        update((previous) => ({ ...previous, roll: spendLocally(previous.roll) }));

        return { idempotencyKey, previewBlob: blob, queued: true, fromBonus: false };
      }
    },
  });
}

/**
 * Rejoue les poses en attente. Appelee au retour du reseau.
 *
 * Le rejeu reprend a l'etape 1 : la reservation est idempotente, elle rendra
 * la meme adresse signee sans reconsommer de pose. Une pose abandonnee apres
 * cinq tentatives est retiree de la file, et son echec signale a l'appelant.
 */
export async function flushQueue(): Promise<{ sent: number; abandoned: number }> {
  let sent = 0;
  let abandoned = 0;

  for (const shot of await pending()) {
    try {
      const reservation = await photoApi.reserve({
        idempotencyKey: shot.idempotencyKey,
        takenAt: new Date(shot.takenAt),
        width: shot.width,
        height: shot.height,
        sizeBytes: shot.blob.size,
      });

      await uploadPhoto(reservation.uploadUrl, shot.blob);
      await photoApi.confirm(shot.idempotencyKey);
      await dequeue(shot.idempotencyKey);
      sent += 1;
    } catch (error) {
      if (!isNetworkError(error)) {
        // Le serveur refuse definitivement : inutile de garder la pose.
        await dequeue(shot.idempotencyKey);
        abandoned += 1;
        continue;
      }

      if ((await markAttempt(shot.idempotencyKey)) >= MAX_ATTEMPTS) {
        await dequeue(shot.idempotencyKey);
        abandoned += 1;
      }
      // Reseau toujours absent : on arrete la boucle, les suivantes echoueraient.
      break;
    }
  }

  return { sent, abandoned };
}

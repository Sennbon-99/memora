// apps/web/src/features/guest/screens/CameraDeniedScreen.tsx
// Secours quand la camera est refusee ou absente.
//
// Cet ecran n'existait pas dans les maquettes du dossier, et c'est le cas le
// plus frequent en soiree : l'invite refuse la permission par reflexe. Le
// selecteur de fichier natif ouvre l'appareil photo du systeme, ce qui permet
// de tenir toute la pellicule sans jamais accorder la permission au site.

import { useRef } from 'react';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { ShotCounter } from '../../../ui/ShotCounter.js';
import { useShot } from '../useShot.js';

interface CameraDeniedScreenProps {
  slug: string;
  denied: boolean;
  shotsLeft: number;
  bonusShots: number;
  queued: number;
}

export function CameraDeniedScreen({
  slug, denied, shotsLeft, bonusShots, queued,
}: CameraDeniedScreenProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shot = useShot(slug);
  const total = shotsLeft + bonusShots;

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    shot.mutate(await createImageBitmap(file));
  };

  return (
    <Screen
      title={denied ? 'Caméra non autorisée' : 'Caméra indisponible'}
      subtitle={
        denied
          ? "Vous pouvez continuer sans rien changer : le bouton ci-dessous ouvre l'appareil photo de votre téléphone."
          : "Votre navigateur ne donne pas accès à la caméra. Le bouton ci-dessous ouvre l'appareil photo de votre téléphone."
      }
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${total} VUES`,
        hautDroite: 'SANS VISEUR',
      }}
      footer={
        <div className="flex flex-col gap-3">
          <Button
            full
            onClick={() => inputRef.current?.click()}
            disabled={shot.isPending || total === 0}
          >
            {shot.isPending ? 'Envoi…' : 'Prendre une photo'}
          </Button>
          {denied && (
            <p className="text-center text-xs leading-relaxed text-ink-3">
              Pour revenir au viseur, autorisez la caméra dans les réglages de
              votre navigateur, puis rechargez la page.
            </p>
          )}
        </div>
      }
    >
      {/* Trois temps plutot qu'un compteur seul sous le titre : l'etat de la
          pellicule, le decompte, ce que fait le declencheur. */}
      <div className="flex flex-1 flex-col justify-between pb-6 pt-7">
        <p className="font-mono text-mini uppercase tracking-[0.24em] text-a1">
          Repli sans viseur
        </p>

        {/* Le compteur suit l'invite jusque sur ce repli : sans lui il ne
            saurait plus combien de vues il lui reste, et c'est la seule
            information qui compte pendant la soiree. */}
        <div className="border-y border-edge py-5">
          <ShotCounter shotsLeft={shotsLeft} bonusShots={bonusShots} queued={queued} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-carte border border-edge bg-pap-2 shadow-[var(--ombre-tirage)] p-5">
            <h2 className="decoupe text-sous-titre leading-tight">La pellicule continue</h2>
            <p className="mt-2.5 text-corps leading-relaxed text-ink-2">
              Chaque vue prise par l’appareil photo de votre téléphone rejoint
              votre pellicule, et le compteur baisse d’autant. Vous ne perdez
              rien à passer par ce chemin.
            </p>
          </div>

          {shot.isError && (
            <p role="alert" className="rounded-champ border border-danger bg-danger-doux
              p-4 text-sm leading-relaxed text-danger">
              {shot.error.message}
            </p>
          )}
        </div>
      </div>

      {/* capture environment demande la camera arriere directement, sans
          passer par la galerie. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
    </Screen>
  );
}

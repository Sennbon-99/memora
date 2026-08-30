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
      footer={
        <div className="flex flex-col gap-3">
          <Button
            full
            onClick={() => inputRef.current?.click()}
            disabled={shot.isPending || total === 0}
          >
            {shot.isPending ? 'Envoi...' : 'Prendre une photo'}
          </Button>
          {denied && (
            <p className="text-center text-xs text-paper/40">
              Pour revenir au viseur, autorisez la caméra dans les réglages de
              votre navigateur, puis rechargez la page.
            </p>
          )}
        </div>
      }
    >
      {/* Le compteur suit l'invite jusque sur ce repli : sans lui il ne
          saurait plus combien de poses il lui reste, et c'est la seule
          information qui compte pendant la soiree. */}
      <div className="mt-8">
        <ShotCounter shotsLeft={shotsLeft} bonusShots={bonusShots} queued={queued} />
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
      {shot.isError && (
        <p role="alert" className="mt-8 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {shot.error.message}
        </p>
      )}
    </Screen>
  );
}

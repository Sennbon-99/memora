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
import { useShot } from '../useShot.js';

export function CameraDeniedScreen({ slug, denied }: { slug: string; denied: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shot = useShot(slug);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    shot.mutate(await createImageBitmap(file));
  };

  return (
    <Screen
      title={denied ? 'Camera non autorisee' : 'Camera indisponible'}
      subtitle={
        denied
          ? "Vous pouvez continuer sans rien changer : le bouton ci-dessous ouvre l'appareil photo de votre telephone."
          : "Votre navigateur ne donne pas acces a la camera. Le bouton ci-dessous ouvre l'appareil photo de votre telephone."
      }
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={() => inputRef.current?.click()} disabled={shot.isPending}>
            {shot.isPending ? 'Envoi...' : 'Prendre une photo'}
          </Button>
          {denied && (
            <p className="text-center text-xs text-white/40">
              Pour revenir au viseur, autorisez la camera dans les reglages de
              votre navigateur, puis rechargez la page.
            </p>
          )}
        </div>
      }
    >
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

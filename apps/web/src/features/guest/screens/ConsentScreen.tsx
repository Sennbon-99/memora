// apps/web/src/features/guest/screens/ConsentScreen.tsx
// Droit a l'image. C'est le premier ecran, et il ne peut pas etre saute.
//
// La regle RG-04 du dossier est appliquee des le client : sans acceptation,
// le viseur n'est pas monte. Le serveur la revalide de toute facon a chaque
// reservation, un client modifie ne contournerait rien.

import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { useConsent } from '../useGuestSession.js';

interface ConsentScreenProps {
  slug: string;
  eventName: string;
  welcomeMessage: string | null;
}

export function ConsentScreen({ slug, eventName, welcomeMessage }: ConsentScreenProps) {
  const consent = useConsent(slug);

  return (
    <Screen
      title={eventName}
      subtitle={welcomeMessage ?? 'Vous etes le photographe de la soiree.'}
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={() => consent.mutate()} disabled={consent.isPending}>
            {consent.isPending ? 'Un instant...' : "J'accepte, je prends mes photos"}
          </Button>
          <p className="text-center text-xs text-ink-3">
            Refuser ferme simplement cette page. Aucune donnée n'est conservée.
          </p>
          {/* Le detail de ce qui est conserve, pour qui veut le lire avant
              d'accepter. Dans un nouvel onglet, et non par navigation : le
              parcours de l'invite ne doit pas se defaire sous ses pieds. */}
          <a
            href="/confidentialite"
            target="_blank"
            rel="noreferrer"
            className="text-center text-xs text-ink-3 underline underline-offset-2"
          >
            Politique de confidentialité
          </a>
        </div>
      }
    >
      <div className="mt-10 space-y-5 text-[15px] leading-relaxed text-ink-2">
        <p>
          Vos photographies sont visibles par l'organisateur de l'événement, puis
          par les invités si l'organisateur décide de les publier.
        </p>
        <p>
          Elles sont conservées trente jours, puis supprimées automatiquement.
          Vous pouvez demander le retrait de l'une d'elles à tout moment.
        </p>
        <p className="text-ink-3">
          Aucun compte, aucun nom, aucune adresse électronique ne vous est
          demandé. La position et le modèle de votre téléphone sont effacés
          avant l'envoi.
        </p>
      </div>

      {consent.isError && (
        <p role="alert" className="mt-6 rounded-carte bg-danger-doux p-4 text-sm text-danger">
          L'enregistrement n'a pas abouti. Vérifiez votre connexion et réessayez.
        </p>
      )}
    </Screen>
  );
}

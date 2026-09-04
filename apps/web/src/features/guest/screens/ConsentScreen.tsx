// apps/web/src/features/guest/screens/ConsentScreen.tsx
// Droit a l'image. C'est le premier ecran, et il ne peut pas etre saute.
//
// La regle RG-04 du dossier est appliquee des le client : sans acceptation,
// le viseur n'est pas monte. Le serveur la revalide de toute facon a chaque
// reservation, un client modifie ne contournerait rien.

import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { useConsent, useDecline } from '../useGuestSession.js';

interface ConsentScreenProps {
  slug: string;
  eventName: string;
  welcomeMessage: string | null;
}

export function ConsentScreen({ slug, eventName, welcomeMessage }: ConsentScreenProps) {
  const consent = useConsent(slug);
  const decline = useDecline(slug);
  const busy = consent.isPending || decline.isPending;

  // Apres un refus, la pellicule n'existe plus : il n'y a plus rien a proposer
  // que de fermer la page. Aucun bouton ne ramene vers la soiree, ce serait
  // rouvrir la porte que l'invite vient de fermer.
  if (decline.isSuccess) {
    return (
      <Screen
        title="C’est noté"
        subtitle="Votre pellicule a été supprimée. Aucune photographie ne partira de ce téléphone."
      >
        <p className="mt-10 text-lecture leading-relaxed text-ink-2">
          Vous pouvez fermer cette page. Si vous changez d’avis pendant la soirée,
          scannez à nouveau le QR code : une pellicule vierge vous sera ouverte.
        </p>
      </Screen>
    );
  }

  return (
    <Screen
      title={eventName}
      subtitle={welcomeMessage ?? 'Bienvenue dans la pellicule partagée de la soirée.'}
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={() => consent.mutate()} disabled={busy}>
            {consent.isPending ? 'Un instant...' : "J'accepte, je prends mes photos"}
          </Button>
          {/* Refuser doit etre un geste, pas l'absence de geste. Une pellicule
              a deja ete ouverte a l'arrivee sur cette page : la fermer sans
              rien dire la laisserait derriere soi. */}
          <Button full tone="ghost" onClick={() => decline.mutate()} disabled={busy}>
            {decline.isPending ? 'Un instant...' : 'Je refuse'}
          </Button>
          <p className="text-center text-xs text-ink-3">
            Refuser supprime la pellicule ouverte sur ce téléphone.
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
      <div className="mt-10 space-y-5 text-lecture leading-relaxed text-ink-2">
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

      {(consent.isError || decline.isError) && (
        <p role="alert" className="mt-6 rounded-carte bg-danger-doux p-4 text-sm text-danger">
          {consent.isError
            ? "L'enregistrement n'a pas abouti. Vérifiez votre connexion et réessayez."
            : "Le refus n'a pas pu être enregistré. Vérifiez votre connexion et réessayez."}
        </p>
      )}
    </Screen>
  );
}

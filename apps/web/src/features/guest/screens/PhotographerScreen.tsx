// apps/web/src/features/guest/screens/PhotographerScreen.tsx
// Entree du photographe officiel.
//
// Il n'a pas de compte et ne passe pas par le QR code des invites : son
// lien lui ouvre une pellicule marquee, sans limite de vues et avec le
// consentement deja acquis — c'est un professionnel engage par l'hote,
// pas un convive.
//
// L'ecran ne fait qu'une chose : echanger le jeton contre un cookie
// d'appareil, puis rendre la main au parcours normal.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teamApi, ApiError } from '../../../lib/api.js';
import { applyCarnet } from '../../../lib/theme.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';

export function PhotographerScreen() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelled = false;

    void teamApi.joinAsPhotographer(token)
      .then(({ event }) => {
        if (cancelled) return;
        applyCarnet(event.carnet);
        // replace et non push : revenir en arriere ne doit pas rejouer
        // l'echange de jeton.
        navigate(`/e/${event.slug}`, { replace: true });
      })
      .catch((error: ApiError) => { if (!cancelled) setFailure(error); });

    return () => { cancelled = true; };
  }, [token, navigate]);

  // L'echange de jeton se fait dans l'enveloppe : sans elle, l'application
  // apparaitrait sans ses bandes le temps de l'aller-retour.
  if (!failure) {
    return (
      <Screen
        title="Pellicule du photographe"
        hideTitle
        code={{ hautGauche: 'MEMORA 400', basGauche: 'PHOTOGRAPHE', hautDroite: 'SANS LIMITE' }}
      >
        <div className="flex flex-1 items-center justify-center">
          <Spinner label="Ouverture de votre pellicule" />
        </div>
      </Screen>
    );
  }

  const closed = failure.code === 'EVENT_CLOSED';

  return (
    <Screen
      title={closed ? 'Soirée terminée' : 'Lien invalide'}
      subtitle={
        closed
          ? 'La prise de vue est close.'
          : 'Ce lien de photographe n’est plus valide.'
      }
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: 'PHOTOGRAPHE',
        hautDroite: closed ? 'SOIRÉE CLOSE' : 'LIEN INVALIDE',
      }}
    >
      {/* Trois temps plutot qu'un titre suivi de rien : la version precedente
          laissait les deux tiers de l'ecran vides sous le sous-titre. */}
      <div className="flex flex-1 flex-col justify-between pb-6 pt-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
          Accès photographe
        </p>

        <div className="border-y border-edge py-6">
          <p className="max-w-[20ch] font-serif text-[26px] leading-[1.15] text-ink-2">
            {closed
              ? 'La pellicule est refermée.'
              : 'Ce lien n’ouvre plus rien.'}
          </p>
        </div>

        <div className="rounded-carte border border-edge bg-pap-2 p-6">
          <p className="text-[15px] leading-relaxed text-ink-2">
            {closed
              ? 'Vos photographies déjà déposées sont conservées trente jours. L’organisateur y a accès pour composer sa sélection.'
              : 'Un lien de photographe est nominatif et révocable. Demandez-en un nouveau à l’organisateur : il le génère depuis son tableau de bord.'}
          </p>
        </div>
      </div>
    </Screen>
  );
}

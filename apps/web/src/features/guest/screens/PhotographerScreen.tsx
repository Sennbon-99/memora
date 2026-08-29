// apps/web/src/features/guest/screens/PhotographerScreen.tsx
// Entree du photographe officiel.
//
// Il n'a pas de compte et ne passe pas par le QR code des invites : son
// lien lui ouvre une pellicule marquee, sans limite de poses et avec le
// consentement deja acquis — c'est un professionnel engage par l'hote,
// pas un convive.
//
// L'ecran ne fait qu'une chose : echanger le jeton contre un cookie
// d'appareil, puis rendre la main au parcours normal.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teamApi, ApiError } from '../../../lib/api.js';
import { applyEventTheme } from '../../../lib/theme.js';
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
        applyEventTheme(event.color);
        // replace et non push : revenir en arriere ne doit pas rejouer
        // l'echange de jeton.
        navigate(`/e/${event.slug}`, { replace: true });
      })
      .catch((error: ApiError) => { if (!cancelled) setFailure(error); });

    return () => { cancelled = true; };
  }, [token, navigate]);

  if (!failure) return <Spinner label="Ouverture de votre pellicule" />;

  return (
    <Screen
      title={failure.code === 'EVENT_CLOSED' ? 'Soirée terminée' : 'Lien invalide'}
      subtitle={
        failure.code === 'EVENT_CLOSED'
          ? 'La prise de vue est close. Vos photographies déjà déposées sont conservées.'
          : 'Ce lien de photographe n’est plus valide. Demandez-en un nouveau à l’organisateur.'
      }
    >
      <span />
    </Screen>
  );
}

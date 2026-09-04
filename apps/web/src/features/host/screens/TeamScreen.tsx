// apps/web/src/features/host/screens/TeamScreen.tsx
// Co-hotes de la soiree.
//
// Deux notions differentes, reunies ici parce qu'elles repondent a la meme
// question : qui d'autre que moi agit sur cette soiree.
//
// Un co-hote a un compte : il aide a trier, publier et moderer. Les actions
// sensibles restent reservees a l'organisateur.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { teamApi, type ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { Section } from '../../../ui/Section.js';
import { useSession } from '../useAuth.js';

const teamKey = (eventId: string) => ['host', 'team', eventId] as const;

export function TeamScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: session } = useSession();

  const [email, setEmail] = useState('');

  const { data, isPending } = useQuery({
    queryKey: teamKey(eventId),
    queryFn: () => teamApi.list(eventId),
    enabled: !!eventId,
  });

  const refresh = () => void client.invalidateQueries({ queryKey: teamKey(eventId) });

  const invite = useMutation({
    mutationFn: () => teamApi.invite(eventId, email.trim()),
    onSuccess: () => { setEmail(''); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => teamApi.remove(eventId, userId),
    onSuccess: refresh,
  });
  if (isPending || !data) return <Spinner label="Chargement de l’équipe" />;

  return (
    <Screen
      title="Qui agit sur la soirée"
      subtitle="Les co-hôtes vous aident à trier, publier et traiter les demandes de retrait."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${data.coHosts.length + 1} PERSONNES`,
        hautDroite: 'ÉQUIPE',
      }}
    >
      <Section title="Co-hôtes" className="mt-8">
        {/* Deux ou trois personnes : une liste de rangees, pas une pile de
            cartes qui donnerait a chacune le poids d'un ecran. */}
        <ul className="flex flex-col">
          <li className="flex items-center gap-3 border-b border-edge-2 px-1 py-3
            last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-note font-bold">{session?.name}</span>
              <span className="block truncate text-mini text-ink-3">{session?.email}</span>
            </span>
            <span className="shrink-0 rounded-full bg-a-doux px-2.5 py-1 text-micro
              font-bold text-a1">vous</span>
          </li>

          {data.coHosts.map((coHost) => (
            <li
              key={coHost.id}
              className="flex items-center gap-3 border-b border-edge-2 px-1 py-3
                last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-note font-bold">{coHost.name}</span>
                <span className="block truncate text-mini text-ink-3">{coHost.email}</span>
              </span>
              <button
                onClick={() => remove.mutate(coHost.id)}
                disabled={remove.isPending}
                className="shrink-0 text-mini font-semibold text-danger"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2.5">
          <Field
            label="Inviter par adresse électronique"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tom@exemple.fr"
            hint="La personne doit déjà avoir un compte Memora."
            error={invite.error ? (invite.error as ApiError).message : undefined}
          />
          <Button
            tone="ghost"
            full
            disabled={!email.includes('@') || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? 'Invitation…' : 'Ajouter ce co-hôte'}
          </Button>
        </div>
      </Section>

      <button
        onClick={() => navigate(`/hote/${eventId}/reglages`)}
        className="pb-4 text-center text-xs text-ink-3"
      >
        ‹ Retour aux réglages
      </button>
    </Screen>
  );
}

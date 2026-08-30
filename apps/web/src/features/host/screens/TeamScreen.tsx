// apps/web/src/features/host/screens/TeamScreen.tsx
// Co-hotes et photographe officiel.
//
// Deux notions differentes, reunies ici parce qu'elles repondent a la meme
// question : qui d'autre que moi agit sur cette soiree.
//
// Un co-hote a un compte et les memes droits que l'hote : il trie, il
// publie. Le photographe, lui, n'a pas de compte du tout — il recoit un
// lien qui lui ouvre une pellicule sans limite de vues. C'est un invite
// particulier, pas un administrateur.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { teamApi, type ApiError } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Field } from '../../../ui/Field.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useSession } from '../useAuth.js';

const teamKey = (eventId: string) => ['host', 'team', eventId] as const;

export function TeamScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: session } = useSession();

  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
  const photographer = useMutation({
    mutationFn: () => teamApi.photographerLink(eventId),
    // Le serveur rend un jeton, pas une adresse : il ignore sous quel nom
    // de domaine le client est servi. On l'assemble ici.
    onSuccess: ({ token }) => setLink(`${window.location.origin}/p/${token}`),
  });

  if (isPending || !data) return <Spinner label="Chargement de l’équipe" />;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papiers refuse : le lien reste selectionnable a la main.
    }
  };

  return (
    <Screen
      title="Qui agit sur la soirée"
      subtitle="Les co-hôtes trient et publient comme vous. Le photographe, lui, photographie sans limite."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${data.coHosts.length + 1} PERSONNES`,
        hautDroite: 'ÉQUIPE',
      }}
    >
      <section className="mt-8">
        <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/40">
          Co-hôtes
        </h2>

        {/* Deux ou trois personnes : une liste de rangees, pas une pile de
            cartes qui donnerait a chacune le poids d'un ecran. */}
        <ul className="mt-1 flex flex-col">
          <li className="flex items-center gap-3 border-b border-gold/12 px-1 py-3
            last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{session?.name}</span>
              <span className="block truncate text-[11px] text-paper/45">{session?.email}</span>
            </span>
            <span className="shrink-0 rounded-full bg-gold/12 px-2.5 py-1 text-[10px]
              font-bold text-gold">vous</span>
          </li>

          {data.coHosts.map((coHost) => (
            <li
              key={coHost.id}
              className="flex items-center gap-3 border-b border-gold/12 px-1 py-3
                last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{coHost.name}</span>
                <span className="block truncate text-[11px] text-paper/45">{coHost.email}</span>
              </span>
              <button
                onClick={() => remove.mutate(coHost.id)}
                disabled={remove.isPending}
                className="shrink-0 text-[11px] font-semibold text-red-400"
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
      </section>

      <section className="mt-9 pb-6">
        <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-paper/40">
          Photographe officiel
        </h2>
        <p className="mt-2 px-1 text-xs leading-relaxed text-paper/45">
          Un lien à lui transmettre. Il ouvre une pellicule sans limite de
          vues, sans compte et sans passer par le QR code des invités.
        </p>

        {link ? (
          <div className="mt-3 rounded-xl border border-gold/30 bg-gold/8 p-4">
            <p className="break-all font-mono text-[11px] leading-relaxed text-gold">
              {link}
            </p>
            <Button full className="mt-3" onClick={() => copy(link)}>
              {copied ? 'Lien copié' : 'Copier le lien'}
            </Button>
            <p className="mt-2.5 text-[11px] leading-relaxed text-paper/40">
              Ce lien vaut accès : ne le publiez pas, transmettez-le à une
              seule personne.
            </p>
          </div>
        ) : (
          <Button
            tone="ghost"
            full
            className="mt-3"
            disabled={photographer.isPending}
            onClick={() => photographer.mutate()}
          >
            {photographer.isPending ? 'Génération…' : 'Générer le lien du photographe'}
          </Button>
        )}
      </section>

      <button
        onClick={() => navigate(`/hote/${eventId}/reglages`)}
        className="pb-4 text-center text-xs text-paper/35"
      >
        ‹ Retour aux réglages
      </button>
    </Screen>
  );
}

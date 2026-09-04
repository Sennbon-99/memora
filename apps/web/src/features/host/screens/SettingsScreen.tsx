// apps/web/src/features/host/screens/SettingsScreen.tsx
// Onglet Reglages.
//
// Deux perimetres se disputent cet ecran : ce qui appartient a la soiree, et
// ce qui appartient au compte. Les melanger dans une liste plate est la faute
// classique. Ici la soiree vient d'abord, parce que l'onglet lui appartient
// comme les trois autres ; le compte est une courte section de pied de page,
// la sortie.
//
// Chaque groupe est un intertitre en petites capitales et des rangees
// separees par un filet. Le cadre plein qui les enfermait faisait trois
// blocs gris de meme poids, ou l'on ne voyait plus la coupure entre la
// soiree et le compte.

import { useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { eventApi, remettreFichier } from '../../../lib/api.js';
import type { ReactNode } from 'react';
import type { PreviewMode } from '@memora/types';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { Section } from '../../../ui/Section.js';
import { useSession, useLogout } from '../useAuth.js';
import { useEvent } from '../useEvents.js';
import { CARNET_LABEL } from '../../../carnets/labels.js';
import type { Carnet } from '@memora/types';
import { useRolls } from '../useRolls.js';

const PREVIEW_LABEL: Record<PreviewMode, string> = {
  NONE: 'Aucun', BLURRED: 'Vignette floutée',
  FLASH: 'Aperçu 2,5 s', CONFIRM: 'Garder ou reprendre',
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title} flush className="mt-8">
      <div className="flex flex-col">{children}</div>
    </Section>
  );
}

/**
 * Une rangee de reglage.
 *
 * La valeur passe en mono quand c'est un chiffre ou une heure : on la lit
 * alors en colonne d'une rangee a l'autre, sans que les chasses dansent.
 */
function Line({ label, value, mono, onClick, danger }: {
  label: string;
  value?: string | undefined;
  mono?: boolean | undefined;
  onClick?: (() => void) | undefined;
  danger?: boolean | undefined;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 border-b border-edge-2 px-4 py-3.5 text-left
        text-note transition last:border-b-0 active:bg-appui disabled:active:bg-transparent
        ${danger ? 'text-danger' : ''}`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value && (
        <span
          className={`shrink-0 text-petit ${mono
            ? 'font-mono tabular-nums text-a1'
            : 'text-ink-3'}`}
        >
          {value}
        </span>
      )}
      {onClick && !danger && <span aria-hidden="true" className="text-a1">›</span>}
    </button>
  );
}

export function SettingsScreen() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data } = useEvent(eventId);
  const { data: rolls } = useRolls(eventId);
  const { data: session } = useSession();
  const logout = useLogout();
  // L'archive d'une soiree bien remplie pese lourd et met du temps a se
  // composer : le libelle doit le dire, sinon l'hote appuie trois fois.
  const archive = useMutation({
    mutationFn: () => eventApi.archive(eventId),
    onSuccess: remettreFichier,
  });

  if (!data) return <Spinner label="Chargement des réglages" />;
  const { event } = data;

  const pending = (rolls?.rolls ?? []).filter((roll) => roll.pendingRemoval).length;
  const edit = (setting: string) => navigate(`/hote/${eventId}/reglage?r=${setting}`);
  const closes = new Date(event.closesAt)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <Screen
      title="Réglages"
      subtitle={event.name}
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: `${event.quotaShots} VUES`,
        hautDroite: 'RÉGLAGES',
        basDroite: event.useTableCodes ? 'AVEC TABLES' : 'SANS TABLES',
      }}
    >
      <Group title="La pellicule">
        <Line label="Vues par invité" value={String(event.quotaShots)} mono onClick={() => edit('quota')} />
        <Line label="Aperçu après la photo" value={PREVIEW_LABEL[event.previewMode]} onClick={() => edit('preview')} />
        <Line label="Fermeture" value={closes} mono onClick={() => edit('closes')} />
        <Line
          label="Numéros de table"
          value={event.useTableCodes ? 'Demandés' : 'Non demandés'}
          onClick={() => edit('tables')}
        />
        <Line label="Mot d’accueil" value={event.welcomeMessage ? 'Défini' : 'Aucun'} onClick={() => edit('welcome')} />
        <Line
          label="Le carnet"
          value={CARNET_LABEL[(event.carnet ?? 'papier') as Carnet]}
          onClick={() => edit('carnet')}
        />
      </Group>

      <Group title="La soirée">
        <Line label="Kit QR à imprimer" onClick={() => navigate(`/hote/${eventId}/kit`)} />
        <Line label="Moments forts" onClick={() => navigate(`/hote/${eventId}/moments`)} />
        <Line
          label="Demandes de retrait"
          value={pending > 0 ? String(pending) : undefined}
          mono
          onClick={() => navigate(`/hote/${eventId}/retraits`)}
        />
        {event.role === 'OWNER' && (
          <Line label="Co-hôtes" onClick={() => navigate(`/hote/${eventId}/equipe`)} />
        )}
        {/* L'archive est construite au fil de l'eau par le serveur, elle ne
            passe pas par le client — mais elle est derriere requireAuth, donc
            elle se recupere avec l'en-tete, pas en ouvrant une adresse. */}
        <Line
          label="Télécharger l’album"
          value={archive.isPending ? 'En cours…' : undefined}
          onClick={() => { if (!archive.isPending) archive.mutate(); }}
        />
      </Group>

      <Group title="Mon compte">
        <Line label={session?.name ?? '—'} value={session?.email} />
        <Line
          label="Se déconnecter"
          danger
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/hote/connexion') })}
        />
      </Group>

      <p className="mt-8 pb-4 text-center text-mini leading-relaxed text-ink-3">
        Les photographies de cette soirée seront effacées automatiquement
        trente jours après sa fermeture.
      </p>
    </Screen>
  );
}

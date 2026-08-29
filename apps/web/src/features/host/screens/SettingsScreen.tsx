// apps/web/src/features/host/screens/SettingsScreen.tsx
// Onglet Reglages.
//
// Deux perimetres se disputent cet ecran : ce qui appartient a la soiree, et
// ce qui appartient au compte. Les melanger dans une liste plate est la faute
// classique. Ici la soiree vient d'abord, parce que l'onglet lui appartient
// comme les trois autres ; le compte est une courte section de pied de page,
// la sortie.

import { useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PREVIEW_MODES, type PreviewMode } from '@memora/types';
import { eventApi } from '../../../lib/api.js';
import { Screen } from '../../../ui/Screen.js';
import { Spinner } from '../../../ui/Spinner.js';
import { useSession, useLogout } from '../useAuth.js';
import { useEvent } from '../useEvents.js';
import { useRolls } from '../useRolls.js';

const PREVIEW_LABEL: Record<PreviewMode, string> = {
  NONE: 'Aucun', BLURRED: 'Vignette floutée',
  FLASH: 'Aperçu 2,5 s', CONFIRM: 'Garder ou reprendre',
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="px-1 font-mono text-[9px] uppercase tracking-[0.13em] text-white/40">{title}</h2>
      <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-white/4">
        {children}
      </div>
    </section>
  );
}

function Line({ label, value, onClick, danger }: {
  label: string;
  value?: string | undefined;
  onClick?: (() => void) | undefined;
  danger?: boolean | undefined;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 border-b border-white/8 px-4 py-3.5 text-left
        text-[13px] last:border-b-0 transition active:bg-white/6 disabled:active:bg-transparent
        ${danger ? 'text-red-400' : ''}`}
    >
      <span className="flex-1">{label}</span>
      {value && <span className="shrink-0 text-[12px] text-white/45">{value}</span>}
      {onClick && !danger && <span aria-hidden="true" className="text-white/30">›</span>}
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

  if (!data) return <Spinner label="Chargement des réglages" />;
  const { event } = data;

  const pending = (rolls?.rolls ?? []).filter((roll) => roll.pendingRemoval).length;
  const closes = new Date(event.closesAt)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <Screen title="Réglages" subtitle={event.name}>
      <Group title="La pellicule">
        <Line label="Poses par invité" value={String(event.quotaShots)} onClick={() => {}} />
        <Line label="Aperçu après la photo" value={PREVIEW_LABEL[event.previewMode]} onClick={() => {}} />
        <Line label="Fermeture" value={closes} onClick={() => {}} />
        <Line
          label="Numéros de table"
          value={event.useTableCodes ? 'Demandés' : 'Non demandés'}
          onClick={() => {}}
        />
      </Group>

      <Group title="La soirée">
        <Line label="Kit QR à imprimer" onClick={() => navigate(`/hote/${eventId}/kit`)} />
        <Line label="Moments forts" onClick={() => navigate(`/hote/${eventId}/moments`)} />
        <Line
          label="Demandes de retrait"
          value={pending > 0 ? String(pending) : undefined}
          onClick={() => navigate(`/hote/${eventId}/retraits`)}
        />
        <Line label="Co-hôtes" onClick={() => navigate(`/hote/${eventId}/equipe`)} />
        {/* Telechargement direct : l'archive est construite au fil de l'eau
            par le serveur, elle ne passe pas par le client. */}
        <Line
          label="Télécharger l’album"
          onClick={() => window.open(`/api/events/${eventId}/download`, '_blank')}
        />
      </Group>

      <Group title="Mon compte">
        <Line label={session?.name ?? '—'} value={session?.email} />
        <Line label="Facturation" onClick={() => navigate('/hote/facturation')} />
        <Line
          label="Se déconnecter"
          danger
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/hote/connexion') })}
        />
      </Group>

      <p className="mt-8 pb-4 text-center text-[11px] leading-relaxed text-white/25">
        Les photographies de cette soirée seront effacées automatiquement
        trente jours après sa fermeture.
      </p>
    </Screen>
  );
}

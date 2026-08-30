// apps/web/src/features/guest/screens/DevelopmentScreen.tsx
// Entre la fin de la pellicule et la publication.
//
// Ce temps mort dure un jour ou deux : l'hote trie. Sans cet ecran,
// l'invite tomberait sur un bouton grise, ce qui ressemble a une panne.
// Ici on lui dit ce qui se passe, et on lui propose la seule chose utile —
// etre prevenu quand l'album arrive.
//
// C'est aussi le seul bon endroit pour demander la permission de notifier :
// le navigateur ne la demande qu'une fois, et un refus est definitif. Ici
// l'invite a une raison de dire oui.

import { useEffect, useState } from 'react';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { fetchVapidKey, pushState, subscribeToPush, type PushState } from '../../../lib/push.js';

export function DevelopmentScreen({ hostLabel, queued, albumReady, onSeeAlbum }: {
  hostLabel: string;
  queued: number;
  albumReady: boolean;
  onSeeAlbum: () => void;
}) {
  const [state, setState] = useState<PushState>('unsupported');
  const [vapid, setVapid] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'idle' | 'busy' | 'done' | 'refused' | 'failed'>('idle');

  useEffect(() => {
    setState(pushState());
    void fetchVapidKey().then(setVapid);
  }, []);

  const ask = async () => {
    if (!vapid) return;
    setOutcome('busy');
    const result = await subscribeToPush(vapid);
    setOutcome(result.ok ? 'done' : result.reason === 'refused' ? 'refused' : 'failed');
    setState(pushState());
  };

  // La notification n'est proposee que si elle peut reellement arriver.
  // On garde la carte visible pendant la demande, pour que le bouton puisse
  // afficher son attente ; elle disparait une fois l'abonnement obtenu.
  const canAsk = vapid !== null && state === 'askable'
    && outcome !== 'done' && outcome !== 'refused';

  return (
    <Screen
      title="Au développement"
      subtitle={`${hostLabel} trient les photographies de la soirée. Cela prend souvent un jour ou deux.`}
      footer={
        <div className="flex flex-col gap-3">
          <Button full disabled={!albumReady} onClick={onSeeAlbum}>
            {albumReady ? "Voir l'album" : 'En attente de publication'}
          </Button>
        </div>
      }
    >
      <div className="mt-9 flex flex-col items-center gap-7">
        {/* Une bobine qui tourne : elle dit que quelque chose est en cours,
            sans promettre une duree qu'on ne connait pas. */}
        <span
          aria-hidden="true"
          className="relative h-24 w-24 rounded-full border-2 border-gold/18
            after:absolute after:-inset-0.5 after:rounded-full after:border-2
            after:border-transparent after:border-t-[var(--accent)]
            after:animate-[spin_2.4s_linear_infinite] motion-reduce:after:animate-none"
        />

        <div className="w-full rounded-xl bg-paper/5 p-5">
          <h2 className="text-base font-bold">
            {queued > 0
              ? `${queued} ${queued > 1 ? 'photos partent' : 'photo part'} dès le retour du réseau`
              : 'Vos photographies sont déposées'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-paper/55">
            Rien ne se perd : elles sont conservées trente jours. Vous pouvez
            fermer cette page.
          </p>
        </div>

        {/* La proposition n'apparait que quand elle a un sens. */}
        {canAsk && (
          <div className="w-full rounded-xl border border-[var(--accent-border)]
            bg-[var(--accent-soft)] p-5">
            <h2 className="text-base font-bold">Être prévenu ?</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/60">
              Une seule notification, quand l’album sera en ligne. Rien d’autre.
            </p>
            <Button full className="mt-4" onClick={ask} disabled={outcome === 'busy'}>
              {outcome === 'busy' ? 'Un instant…' : 'Me prévenir'}
            </Button>
          </div>
        )}

        {state === 'needs-install' && (
          <p className="text-center text-xs leading-relaxed text-paper/40">
            Pour être prévenu sur iPhone, ajoutez d’abord Memora à votre écran
            d’accueil&nbsp;: touchez Partager, puis « Sur l’écran d’accueil ».
            La proposition apparaîtra ensuite.
          </p>
        )}

        {outcome === 'done' && (
          <p role="status" className="text-center text-xs text-emerald-400">
            C’est noté. Vous serez prévenu dès la publication.
          </p>
        )}
        {outcome === 'refused' && (
          <p role="status" className="text-center text-xs leading-relaxed text-paper/40">
            Pas de notification. Revenez sur cette page dans un jour ou deux,
            l’album y sera.
          </p>
        )}
        {outcome === 'failed' && (
          <p role="alert" className="text-center text-xs text-red-300">
            L’abonnement n’a pas abouti. Revenez sur cette page plus tard.
          </p>
        )}
      </div>
    </Screen>
  );
}

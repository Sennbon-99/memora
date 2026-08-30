// apps/web/src/features/host/screens/PublishSheet.tsx
// Choix de la portee, demande une seule fois par soiree.
//
// L'hote decide qui verra l'album, et ce choix vaut pour toutes les
// publications suivantes. Le redemander a chaque lot ferait douze decisions
// au lieu d'une, et un album dont les regles varient selon la photographie.

import { useState } from 'react';
import { PUBLICATION_SCOPES, type PublicationScope } from '@memora/types';
import { Button } from '../../../ui/Button.js';

const CHOICES: { value: PublicationScope; label: string; note: string }[] = [
  {
    value: 'EVERYONE',
    label: 'Tous les invités',
    note: 'Chacun voit l’album complet de la soirée.',
  },
  {
    value: 'OWN_ONLY',
    label: 'Ses photos seulement',
    note: 'Chaque invité ne retrouve que les photographies qu’il a prises.',
  },
  {
    value: 'SELECTED',
    label: 'Par lien de partage',
    note: 'Seules les personnes à qui vous donnez le lien y accèdent.',
  },
];

export function PublishSheet({ count, busy, onCancel, onConfirm }: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (scope: PublicationScope) => void;
}) {
  const [scope, setScope] = useState<PublicationScope>('EVERYONE');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Publier l’album"
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <button
        aria-label="Annuler"
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 animate-[fade_.2s_ease] motion-reduce:animate-none"
      />

      <div className="relative m-3 rounded-xl border border-gold/18 bg-[#0E0A13] p-5
        animate-[rise_.26s_cubic-bezier(.2,.8,.2,1)] motion-reduce:animate-none safe-bottom">
        <h2 className="text-lg font-extrabold tracking-tight">Qui pourra voir l’album ?</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-paper/50">
          {count} photographie{count > 1 ? 's' : ''} prête{count > 1 ? 's' : ''} à être publiée
          {count > 1 ? 's' : ''}. Ce choix vaut pour toute la soirée : les publications
          suivantes le suivront.
        </p>

        <div role="radiogroup" className="mt-4 flex flex-col gap-2">
          {CHOICES.map((choice) => {
            const selected = choice.value === scope;
            return (
              <button
                key={choice.value}
                role="radio"
                aria-checked={selected}
                onClick={() => setScope(choice.value)}
                className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left
                  ${selected ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-gold/18'}`}
              >
                <span
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2
                    ${selected
                      ? 'border-[var(--accent)] bg-[radial-gradient(circle,var(--accent)_0_42%,transparent_45%)]'
                      : 'border-paper/20'}`}
                />
                <span>
                  <span className="block text-[13px] font-bold">{choice.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-paper/45">
                    {choice.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <Button tone="ghost" className="flex-1" onClick={onCancel}>Annuler</Button>
          <Button className="flex-1" disabled={busy} onClick={() => onConfirm(scope)}>
            {busy ? 'Publication…' : 'Publier'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Les portees connues, pour les tests et la documentation. */
export const KNOWN_SCOPES = PUBLICATION_SCOPES;

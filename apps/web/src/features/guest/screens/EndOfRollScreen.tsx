// apps/web/src/features/guest/screens/EndOfRollScreen.tsx
// Fin de pellicule. Trois choses se jouent ici, et une seule fois.
//
//   - le lien personnel, qui permet de retrouver l'album depuis un autre
//     appareil si le cookie est perdu, y compris sans prenom
//   - l'attente de la publication, decidee par l'hote et non par une minuterie

import { useState } from 'react';
import { guestApi, publicAppOrigin } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';

interface EndOfRollScreenProps {
  slug: string;
  queued: number;
  onSeeAlbum: () => void;
  albumReady: boolean;
}

export function EndOfRollScreen({
  slug, queued, onSeeAlbum, albumReady,
}: EndOfRollScreenProps) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLink = async () => {
    setError(null);
    setBusy(true);
    try {
      const { token } = await guestApi.recoveryLink(slug);
      const personal = `${publicAppOrigin()}/e/${slug}?r=${encodeURIComponent(token)}`;
      setLink(personal);
      try {
        await navigator.clipboard.writeText(personal);
        setCopied(true);
      } catch {
        // Le champ reste visible et selectionnable si le presse-papiers est refuse.
      }
    } catch {
      setError("Le lien n'a pas pu être créé. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('Sélectionnez le lien puis copiez-le manuellement.');
    }
  };

  return (
    <Screen
      title="Pellicule terminée"
      subtitle="Vos photographies sont arrivées. Elles apparaîtront ici quand l’organisateur les aura publiées."
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: 'FIN DE PELLICULE',
        hautDroite: 'DÉVELOPPEMENT',
      }}
      footer={
        <Button full onClick={onSeeAlbum}>
          {albumReady ? "Voir l'album" : 'Continuer'}
        </Button>
      }
    >
      {/* Trois temps qui tiennent la hauteur : l'etat de la pellicule, le
          decompte des envois, le code de secours. La version precedente
          posait une seule carte sous le titre et laissait le reste vide. */}
      <div className="flex flex-1 flex-col justify-between pb-6 pt-7">
        <p className="font-mono text-mini uppercase tracking-[0.24em] text-a1">
          Toutes vos vues sont parties
        </p>

        <div className="flex items-center gap-4 border-y border-edge py-5">
          <span className="font-mono text-grand leading-none tabular-nums text-a1">
            {queued}
          </span>
          <p className="text-corps leading-relaxed text-ink-2">
            {queued > 0
              ? `${queued > 1 ? 'vues attendent' : 'vue attend'} le retour du réseau. Elles partent seules, vous pouvez fermer cette page.`
              : 'vue en attente d’envoi. Tout est arrivé à bon port.'}
          </p>
        </div>

        <div className="rounded-carte border border-edge bg-pap-2 shadow-[var(--ombre-tirage)] p-6">
          <p className="font-mono text-mini uppercase tracking-[0.24em] text-a1">
            Lien personnel
          </p>
          <h2 className="mt-2 decoupe text-sous-titre leading-tight">
            Revenez sans rescanner
          </h2>
          <p className="mt-2.5 text-corps leading-relaxed text-ink-2">
            Gardez ce lien privé. Il retrouve votre pellicule sur ce téléphone
            ou un autre, puis ouvre les photos autorisées par l’organisateur.
          </p>

          {link ? (
            <div className="mt-5 flex flex-col gap-3">
              <input
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Votre lien personnel"
                className="h-12 w-full rounded-champ bg-pap px-4 font-mono text-xs
                  text-ink focus:outline-2 focus:outline-a1"
              />
              <Button full tone="ghost" onClick={copyLink}>
                {copied ? 'Lien copié' : 'Copier le lien'}
              </Button>
            </div>
          ) : (
            <Button full tone="ghost" className="mt-5" onClick={createLink} disabled={busy}>
              {busy ? 'Création…' : 'Créer et copier mon lien'}
            </Button>
          )}

          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </Screen>
  );
}

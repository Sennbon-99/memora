// apps/web/src/features/guest/screens/EndOfRollScreen.tsx
// Fin de pellicule. Trois choses se jouent ici, et une seule fois.
//
//   - le code a quatre chiffres, qui permet de retrouver l'album depuis un
//     autre appareil si le cookie est perdu
//   - la proposition d'installation, placee ici et pas a l'arrivee : demander
//     d'installer une application avant d'avoir rien vu fait fuir
//   - l'attente de la publication, decidee par l'hote et non par une minuterie

import { useState } from 'react';
import { guestApi } from '../../../lib/api.js';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';
import { InstallPrompt } from './InstallPrompt.js';

interface EndOfRollScreenProps {
  slug: string;
  firstName: string | null;
  queued: number;
  onSeeAlbum: () => void;
  albumReady: boolean;
}

export function EndOfRollScreen({
  slug, firstName, queued, onSeeAlbum, albumReady,
}: EndOfRollScreenProps) {
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveCode = async () => {
    setError(null);
    try {
      await guestApi.saveCode(slug, code);
      setSaved(true);
    } catch {
      setError("Le code n'a pas pu être enregistré. Réessayez.");
    }
  };

  return (
    <Screen
      title="Pellicule terminée"
      subtitle={
        queued > 0
          ? `${queued} ${queued > 1 ? 'photos partent' : 'photo part'} des que le reseau revient.`
          : 'Vos photos sont arrivées. Elles apparaîtront ici quand les mariés les auront publiées.'
      }
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={onSeeAlbum} disabled={!albumReady}>
            {albumReady ? "Voir l'album" : 'En attente de publication'}
          </Button>
          <InstallPrompt />
        </div>
      }
    >
      <div className="mt-10 rounded-xl bg-paper/5 p-6">
        <h2 className="text-base font-semibold">Retrouver vos photos plus tard</h2>
        <p className="mt-2 text-sm leading-relaxed text-paper/60">
          Ce téléphone se souvient de vous. Choisissez un code à quatre chiffres
          si vous voulez aussi y acceder depuis un autre appareil
          {firstName ? `, avec le prenom ${firstName}` : ''}.
        </p>

        {saved ? (
          <p className="mt-5 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-sm
            text-[var(--accent)]">
            Code enregistre. Notez-le, il ne sera plus affiche.
          </p>
        ) : (
          <div className="mt-5 flex gap-3">
            <label className="flex-1">
              <span className="sr-only">Code à quatre chiffres</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0000"
                className="h-12 w-full rounded-lg bg-paper/8 px-4 text-center font-mono
                  text-xl tracking-[0.4em] text-paper placeholder:text-paper/20
                  focus:outline-2 focus:outline-[var(--accent)]"
              />
            </label>
            <Button tone="ghost" onClick={saveCode} disabled={code.length !== 4}>
              Garder
            </Button>
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </Screen>
  );
}

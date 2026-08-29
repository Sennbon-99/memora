// apps/web/src/features/guest/screens/EntryScreen.tsx
// Ecran d'entree, quand on arrive sans adresse de soiree.
//
// Il existe surtout pour l'application native : un invite qui l'a installee
// la rouvre parfois sans passer par le QR code, et rediriger vers la
// connexion de l'hote lui demanderait un compte qu'il n'a pas et n'aura
// jamais. La promesse du produit est justement qu'il n'en ait pas besoin.

import { useNavigate } from 'react-router-dom';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';

export function EntryScreen() {
  const navigate = useNavigate();

  return (
    <Screen
      title="Memora"
      subtitle="Un appareil photo jetable pour votre soirée."
      footer={
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm leading-relaxed text-white/50">
            Scannez le QR code posé sur votre table.<br />
            Il ouvre votre pellicule, sans compte ni inscription.
          </p>
          <Button tone="ghost" full onClick={() => navigate('/hote')}>
            Je suis l’organisateur
          </Button>
        </div>
      }
    >
      <div className="mt-12 flex flex-1 items-center justify-center">
        {/* Un carré de QR code stylisé : il dit ce qu'on attend de l'invité
            sans une ligne de texte de plus. */}
        <div
          aria-hidden="true"
          className="h-36 w-36 rounded-3xl bg-white/6 p-6"
        >
          <div
            className="h-full w-full opacity-60"
            style={{
              background:
                'conic-gradient(#F2EDE4 0 25%, transparent 0 50%, #F2EDE4 0 75%, transparent 0),' +
                'conic-gradient(#F2EDE4 0 25%, transparent 0 50%, #F2EDE4 0 75%, transparent 0) 7px 7px',
              backgroundSize: '18px 18px, 11px 11px',
            }}
          />
        </div>
      </div>
    </Screen>
  );
}

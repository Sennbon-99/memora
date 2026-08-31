// apps/web/src/features/guest/screens/EntryScreen.tsx
// Ecran d'entree, quand on arrive sans adresse de soiree.
//
// Il existe surtout pour l'application installee : un invite la rouvre
// parfois sans passer par le QR code, et le renvoyer vers la connexion de
// l'hote lui demanderait un compte qu'il n'a pas et n'aura jamais. La
// promesse du produit est justement qu'il n'en ait pas besoin.

import { useNavigate } from 'react-router-dom';
import { Button } from '../../../ui/Button.js';
import { Screen } from '../../../ui/Screen.js';

export function EntryScreen() {
  const navigate = useNavigate();

  return (
    <Screen
      title="Memora"
      hideTitle
      code={{ hautGauche: 'MEMORA 400', basGauche: '24 VUES', hautDroite: 'SANS COMPTE' }}
      footer={
        <Button tone="ghost" full onClick={() => navigate('/hote')}>
          Je suis l’organisateur
        </Button>
      }
    >
      {/* La page se compose en trois temps qui occupent toute la hauteur : la
          marque, la promesse, le geste attendu. La version precedente laissait
          un tiers de l'ecran vide au milieu, faute de rythme. */}
      <div className="flex flex-1 flex-col justify-between pb-6 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-a1">
          Appareil photo jetable · soirées
        </p>

        <div>
          <h2 className="font-serif text-[64px] leading-[0.88] tracking-tight">Memora</h2>
          <p className="mt-6 max-w-[19ch] font-serif text-[26px] leading-[1.15] text-ink-2">
            Votre soirée vue par tous ceux qui y étaient.
          </p>
        </div>

        <div className="flex items-center gap-4 border-t border-edge pt-6">
          {/* Un carre de QR code stylise : il dit ce qu'on attend de l'invite
              sans une ligne de texte de plus. */}
          <div aria-hidden="true" className="size-16 shrink-0 rounded-champ bg-pap-2 p-3">
            <div
              className="h-full w-full opacity-70"
              style={{
                background:
                  'conic-gradient(#C9A961 0 25%, transparent 0 50%, #C9A961 0 75%, transparent 0),' +
                  'conic-gradient(#C9A961 0 25%, transparent 0 50%, #C9A961 0 75%, transparent 0) 4px 4px',
                backgroundSize: '10px 10px, 6px 6px',
              }}
            />
          </div>
          <p className="text-[14px] leading-relaxed text-ink-2">
            Scannez le QR code posé sur votre table. Il charge votre pellicule,
            sans compte ni inscription.
          </p>
        </div>
      </div>
    </Screen>
  );
}

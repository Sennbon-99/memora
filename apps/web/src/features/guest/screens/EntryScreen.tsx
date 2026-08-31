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
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold">
          Appareil photo jetable · soirées
        </p>

        <div>
          <h2 className="font-serif text-[64px] leading-[0.88] tracking-tight">Memora</h2>
          <p className="mt-6 max-w-[19ch] font-serif text-[26px] leading-[1.15] text-paper/75">
            Votre soirée vue par tous ceux qui y étaient.
          </p>
        </div>

        <div className="flex items-center gap-4 border-t border-gold/20 pt-6">
          {/* Un carre de visee, et non un faux code.
              Ici, aucune soiree n'est connue : il n'y a rien a encoder. Le
              damier qui occupait cette place ressemblait a un QR code sans en
              etre un, juste a cote d'une phrase qui dit « scannez » — et des
              gens ont essaye de le scanner. Une icone ne ment pas. */}
          <div aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-md
            bg-surface text-gold/70">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
            </svg>
          </div>
          <p className="text-[14px] leading-relaxed text-paper/55">
            Scannez le QR code posé sur votre table. Il charge votre pellicule,
            sans compte ni inscription.
          </p>
        </div>
      </div>
    </Screen>
  );
}

// apps/web/src/features/guest/screens/EntryScreen.tsx
// Ecran d'entree, quand on arrive sans adresse de soiree.
//
// Il existe surtout pour l'application installee : un invite la rouvre
// parfois sans passer par le QR code, et le renvoyer vers la connexion de
// l'hote lui demanderait un compte qu'il n'a pas et n'aura jamais. La
// promesse du produit est justement qu'il n'en ait pas besoin.

import { useNavigate } from 'react-router-dom';
import { Button } from '../../../ui/Button.js';
import { Icon } from '../../../ui/Icon.js';
import { Screen } from '../../../ui/Screen.js';
import { presentationVue } from '../../onboarding/Onboarding.js';

export function EntryScreen() {
  const navigate = useNavigate();

  // La presentation ne s'impose qu'une fois. Ensuite l'invite va droit au
  // scan : a la deuxieme soiree, il sait deja ce qu'est une pellicule.
  const rejoindre = () =>
    navigate(presentationVue('invite') ? '/scan' : '/decouvrir');

  return (
    <Screen
      title="Memora"
      hideTitle
      code={{ hautGauche: 'MEMORA 400', basGauche: '24 VUES', hautDroite: 'SANS COMPTE' }}
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={rejoindre}>
            Je suis un invité
          </Button>
          <Button tone="ghost" full onClick={() => navigate('/hote')}>
            Je suis l’organisateur
          </Button>
        </div>
      }
    >
      {/* La page se compose en trois temps qui occupent toute la hauteur : la
          marque, la promesse, le geste attendu. La version precedente laissait
          un tiers de l'ecran vide au milieu, faute de rythme. */}
      <div className="flex flex-1 flex-col justify-between pb-6 pt-4">
        <p className="font-mono text-mini uppercase tracking-[0.24em] text-a1">
          Appareil photo jetable · soirées
        </p>

        <div>
          <h2 className="decoupe text-marque leading-[0.88] tracking-tight">Memora</h2>
          <p className="mt-6 max-w-[19ch] decoupe text-titre leading-[1.15] text-ink-2">
            Votre soirée vue par tous ceux qui y étaient.
          </p>
        </div>

        <div className="flex items-center gap-4 border-t border-edge pt-6">
          {/* Une icone, et non un faux code. Ici aucune soiree n'est connue :
              il n'y a rien a encoder. Le damier qui occupait cette place
              ressemblait a un vrai code sans en etre un, juste a cote d'une
              phrase qui dit « scannez » — et des gens ont essaye de le
              scanner. Un pictogramme de vingt-quatre unites de cote ne ment
              pas ; un damier de donnees, si. */}
          <Icon nom="qr" taille={44} className="text-a1" />
          <p className="text-corps leading-relaxed text-ink-2">
            Scannez le QR code posé sur votre table. Il charge votre pellicule,
            sans compte ni inscription.
          </p>
        </div>
      </div>
    </Screen>
  );
}

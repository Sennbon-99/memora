// apps/web/src/features/onboarding/Onboarding.tsx
// Les deux presentations : celle de l'hote, celle de l'invite.
//
// Memora demande deux choses qu'aucune application photo ne demande : ne pas
// revoir sa photographie apres l'avoir prise, et attendre le lendemain pour
// voir celles des autres. Les deux sont des partis pris, pas des manques.
// Non expliques, ils passent pour des pannes — un invite appuie, rien ne
// s'affiche, il croit que la photographie est perdue et recommence, brulant
// ses vues.
//
// D'ou une presentation par role, et deux principes tenus : elle se saute
// toujours, et elle ne revient jamais d'elle-meme. Une presentation qu'on
// subit deux fois est une presentation qu'on apprend a fermer sans lire.

import { useCallback, useState } from 'react';
import { Button } from '../../ui/Button.js';
import { Icon, type NomIcone } from '../../ui/Icon.js';
import { Screen } from '../../ui/Screen.js';

export type Public = 'hote' | 'invite';

interface Etape {
  icone: NomIcone;
  titre: string;
  texte: string;
}

const ETAPES: Record<Public, Etape[]> = {
  invite: [
    {
      icone: 'pellicule',
      titre: 'Vous avez une pellicule',
      texte:
        'Un nombre de vues fixe, comme dans un appareil jetable. Quand elles sont ' +
        'épuisées, la soirée continue sans vous derrière l’objectif.',
    },
    {
      icone: 'obturateur',
      titre: 'Aucun aperçu',
      texte:
        'Vous ne revoyez pas votre photographie après l’avoir prise. C’est voulu : ' +
        'on cadre, on déclenche, on retourne à la fête.',
    },
    {
      icone: 'horloge',
      titre: 'Le développement',
      texte:
        'Tout le monde découvre les photographies après la soirée, en même temps, ' +
        'quand l’organisateur publie l’album.',
    },
  ],
  hote: [
    {
      icone: 'qr',
      titre: 'Un QR code par table',
      texte:
        'Vos invités le scannent et photographient aussitôt. Pas de compte, pas ' +
        'd’installation, pas de mot de passe à retenir un soir de fête.',
    },
    {
      icone: 'planche',
      titre: 'Vous triez, ensuite',
      texte:
        'Les photographies arrivent sur une planche contact. Vous gardez, vous ' +
        'écartez, et vous seul décidez de ce qui sera publié.',
    },
    {
      icone: 'partager',
      titre: 'Vous publiez une fois',
      texte:
        'Un lien unique ouvre l’album à tous ceux qui étaient là. Ils n’ont ' +
        'toujours besoin de rien pour le voir.',
    },
  ],
};

const CODES: Record<Public, string> = { hote: 'ORGANISATEUR', invite: 'INVITÉ' };

/** Cle de memorisation. Le role est dans la cle : on peut etre les deux. */
export function cleVue(role: Public): string {
  return `memora.presentation.${role}`;
}

export function presentationVue(role: Public): boolean {
  try {
    return localStorage.getItem(cleVue(role)) === '1';
  } catch {
    // Navigation privee, stockage refuse : on considere la presentation vue.
    // Mieux vaut la manquer que l'imposer a chaque ouverture.
    return true;
  }
}

export function marquerVue(role: Public): void {
  try {
    localStorage.setItem(cleVue(role), '1');
  } catch {
    // Sans stockage, rien a memoriser : l'ecran appelant enchaine quand meme.
  }
}

interface OnboardingProps {
  role: Public;
  /** Appele a la fin comme au saut : les deux mènent au meme endroit. */
  onDone: () => void;
}

export function Onboarding({ role, onDone }: OnboardingProps) {
  const etapes = ETAPES[role];
  const [index, setIndex] = useState(0);
  const derniere = index === etapes.length - 1;

  const terminer = useCallback(() => {
    marquerVue(role);
    onDone();
  }, [role, onDone]);

  const etape = etapes[index];
  if (!etape) return null;

  return (
    <Screen
      title={etape.titre}
      subtitle={etape.texte}
      code={{
        hautGauche: 'MEMORA 400',
        basGauche: CODES[role],
        // « SUR » plutot qu'une barre oblique : les bandes ecrivent a la
        // verticale, et une oblique couchee se lit comme un trait perdu.
        hautDroite: `${index + 1} SUR ${etapes.length}`,
      }}
      footer={
        <div className="flex flex-col gap-3">
          <Button full onClick={() => (derniere ? terminer() : setIndex((i) => i + 1))}>
            {derniere ? 'Commencer' : 'Suivant'}
          </Button>
          {!derniere && (
            <Button tone="ghost" full onClick={terminer}>
              Passer
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-center gap-10 pb-8">
        <Icon nom={etape.icone} taille={92} className="mx-auto text-a1" />

        {/* Le compteur de position : des perforations, pas des pastilles.
            Le meme motif que les bandes laterales, a l'horizontale. */}
        <div aria-hidden="true" className="flex justify-center gap-2">
          {etapes.map((_, rang) => (
            <span
              key={rang}
              className={`h-1.5 rounded-sm transition-all duration-300 motion-reduce:transition-none
                ${rang === index ? 'w-8 bg-a1' : 'w-4 bg-edge'}`}
            />
          ))}
        </div>
      </div>
    </Screen>
  );
}

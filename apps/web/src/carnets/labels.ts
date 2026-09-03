// apps/web/src/carnets/labels.ts
// Les carnets, dits comme l'hote les choisit.
//
// Ce n'est pas un theme, c'est un carnet : le vocabulaire fait la moitie du
// travail. « Theme », « apparence », « skin » sonnent comme un reglage
// technique qu'on remet a plus tard ; un carnet est un objet qu'on choisit.

import type { Carnet } from '@memora/types';

export const CARNET_LABEL: Record<Carnet, string> = {
  papier: 'Papier',
  'carnet-noir': 'Carnet noir',
  bleu: 'Bleu de bureau',
};

/** Ce que chaque carnet promet, en une phrase, au moment du choix. */
export const CARNET_NOTE: Record<Carnet, string> = {
  papier:
    "Creme et quadrille, comme un carnet d'ecolier. Celui de Memora, et celui qui va a tout.",
  'carnet-noir':
    'Pages noires, tirages a bord blanc. De loin le meilleur pour montrer des photographies.',
  bleu:
    "Une encre bleue et un quadrillage net. Sobre, sans modifier les couleurs des photographies.",
};

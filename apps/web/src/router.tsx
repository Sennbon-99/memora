// apps/web/src/router.tsx
// Table des adresses.
//
// L'adresse d'un invite est /e/:slug, celle du QR code imprime. Elle ne
// change jamais pendant la soiree : tout le parcours se joue derriere, sans
// navigation, parce qu'un invite qui appuie sur Precedent en pleine soiree
// ne doit pas sortir de sa pellicule.

import { createBrowserRouter } from 'react-router-dom';
import { GuestJourney } from './features/guest/GuestJourney.js';

export const router = createBrowserRouter([
  { path: '/e/:slug', element: <GuestJourney /> },
  {
    path: '*',
    element: (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <p className="text-sm text-white/50">
          Scannez le QR code de la soiree pour ouvrir votre pellicule.
        </p>
      </div>
    ),
  },
]);

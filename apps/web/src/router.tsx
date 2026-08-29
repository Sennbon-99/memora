// apps/web/src/router.tsx
// Table des adresses.
//
// Deux mondes qui ne se croisent jamais. L'invite vit sous /e/:slug, l'adresse
// du QR code imprime : tout son parcours se joue derriere, sans navigation,
// parce qu'un invite qui appuie sur Precedent en pleine soiree ne doit pas
// sortir de sa pellicule. L'hote vit sous /hote, derriere une session.

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { GuestJourney } from './features/guest/GuestJourney.js';
import { HostLayout, RequireHost } from './features/host/HostLayout.js';
import { CreateEventScreen } from './features/host/screens/CreateEventScreen.js';
import { DashboardScreen } from './features/host/screens/DashboardScreen.js';
import { EventListScreen } from './features/host/screens/EventListScreen.js';
import { GuestsScreen } from './features/host/screens/GuestsScreen.js';
import { PhotosScreen } from './features/host/screens/PhotosScreen.js';
import { SettingsScreen } from './features/host/screens/SettingsScreen.js';
import { LoginScreen } from './features/host/screens/LoginScreen.js';
import { QrKitScreen } from './features/host/screens/QrKitScreen.js';
import { ReviewScreen } from './features/host/screens/ReviewScreen.js';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/hote" replace /> },

  // Parcours invite : aucune session, aucun compte.
  { path: '/e/:slug', element: <GuestJourney /> },

  // Espace hote.
  { path: '/hote/connexion', element: <LoginScreen /> },
  {
    element: <RequireHost />,
    children: [
      {
        element: <HostLayout />,
        children: [
          { path: '/hote', element: <EventListScreen /> },
          { path: '/hote/nouvelle', element: <CreateEventScreen /> },
          // Les quatre onglets d'une soiree.
          { path: '/hote/:eventId', element: <DashboardScreen /> },
          { path: '/hote/:eventId/photos', element: <PhotosScreen /> },
          { path: '/hote/:eventId/invites', element: <GuestsScreen /> },
          { path: '/hote/:eventId/reglages', element: <SettingsScreen /> },
          // Ecrans pousses par-dessus les onglets.
          { path: '/hote/:eventId/kit', element: <QrKitScreen /> },
        ],
      },
      // Le tri occupe tout l'ecran : la barre d'onglets disparait, comme
      // le mode camera d'une application photo masque la sienne.
      {
        children: [
          { path: '/hote/:eventId/tri/:rollId', element: <ReviewScreen /> },
        ],
      },
    ],
  },

  {
    path: '*',
    element: (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <p className="text-sm text-white/50">
          Scannez le QR code de la soirée pour ouvrir votre pellicule.
        </p>
      </div>
    ),
  },
]);

// apps/web/src/router.tsx
// Table des adresses.
//
// Deux mondes qui ne se croisent jamais. L'invite vit sous /e/:slug, l'adresse
// du QR code imprime : tout son parcours se joue derriere, sans navigation,
// parce qu'un invite qui appuie sur Precedent en pleine soiree ne doit pas
// sortir de sa pellicule. L'hote vit sous /hote, derriere une session.

import { createBrowserRouter } from 'react-router-dom';
import { EntryScreen } from './features/guest/screens/EntryScreen.js';
import { GuestJourney } from './features/guest/GuestJourney.js';
import { PhotographerScreen } from './features/guest/screens/PhotographerScreen.js';
import { PublicAlbumScreen } from './features/guest/screens/PublicAlbumScreen.js';
import { ScanScreen } from './features/guest/screens/ScanScreen.js';
import { ConfidentialiteScreen } from './features/legal/ConfidentialiteScreen.js';
import { DecouverteHote, DecouverteInvite } from './features/onboarding/routes.js';
import { HostLayout, RequireHost } from './features/host/HostLayout.js';
import { CreateEventScreen } from './features/host/screens/CreateEventScreen.js';
import { DashboardScreen } from './features/host/screens/DashboardScreen.js';
import { EventListScreen } from './features/host/screens/EventListScreen.js';
import { GuestsScreen } from './features/host/screens/GuestsScreen.js';
import { PhotosScreen } from './features/host/screens/PhotosScreen.js';
import { SettingsScreen } from './features/host/screens/SettingsScreen.js';
import { LoginScreen } from './features/host/screens/LoginScreen.js';
import { BillingScreen } from './features/host/screens/BillingScreen.js';
import { EditSettingScreen } from './features/host/screens/EditSettingScreen.js';
import { MomentsScreen } from './features/host/screens/MomentsScreen.js';
import { TeamScreen } from './features/host/screens/TeamScreen.js';
import { QrKitScreen } from './features/host/screens/QrKitScreen.js';
import { RemovalsScreen } from './features/host/screens/RemovalsScreen.js';
import { ReviewScreen } from './features/host/screens/ReviewScreen.js';

export const router = createBrowserRouter([
  // Pas de redirection vers l'espace de l'hote : l'application native est
  // installee par des invites, a qui l'on ne demande jamais de compte.
  { path: '/', element: <EntryScreen /> },

  // La politique de confidentialite. Publique, hors de tout parcours et hors
  // de toute session : son adresse est deposee telle quelle dans App Store
  // Connect, qui refuse la soumission sans elle, et un invite doit pouvoir
  // l'ouvrir avant meme d'avoir accepte quoi que ce soit.
  { path: '/confidentialite', element: <ConfidentialiteScreen /> },

  // Parcours invite : aucune session, aucun compte.
  { path: '/e/:slug', element: <GuestJourney /> },
  // Un invite qui rouvre l'application sans son QR code sous les yeux.
  { path: '/scan', element: <ScanScreen /> },
  { path: '/decouvrir', element: <DecouverteInvite /> },
  // Album partage par lien : ni QR code ni pellicule.
  { path: '/album/:token', element: <PublicAlbumScreen /> },
  // Lien du photographe officiel : il echange son jeton puis rejoint
  // le parcours normal.
  { path: '/p/:token', element: <PhotographerScreen /> },

  // Espace hote.
  { path: '/hote/connexion', element: <LoginScreen /> },
  { path: '/hote/decouvrir', element: <DecouverteHote /> },
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
          { path: '/hote/:eventId/moments', element: <MomentsScreen /> },
          { path: '/hote/:eventId/retraits', element: <RemovalsScreen /> },
          { path: '/hote/:eventId/equipe', element: <TeamScreen /> },
          { path: '/hote/:eventId/reglage', element: <EditSettingScreen /> },
          { path: '/hote/:eventId/facturation', element: <BillingScreen /> },
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

  // Toute adresse inconnue retombe sur l'entree plutot que sur un message
  // d'erreur : dans une application installee, il n'y a pas de barre
  // d'adresse pour se rattraper.
  { path: '*', element: <EntryScreen /> },
]);

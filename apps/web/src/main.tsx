// apps/web/src/main.tsx
// Point d'entree du client.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.js';
import { ecouterLesPortes } from './lib/natif.js';
import './styles.css';

/**
 * Un seul client de requetes pour toute l'application.
 *
 * refetchOnWindowFocus desactive : un invite qui revient sur l'onglet ne doit
 * pas declencher une salve de requetes en pleine soiree, sur un reseau deja
 * sature par deux cents telephones.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

// L'application installee recoit ses adresses par le natif — QR code
// scanne avec l'appareil photo, notification touchee — et non par la barre
// du navigateur. Sur le web, l'appel ne fait rien.
ecouterLesPortes((chemin) => void router.navigate(chemin));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

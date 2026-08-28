// apps/web/src/features/guest/useOnline.ts
// Etat du reseau, et rejeu de la file au retour de la connexion.
//
// navigator.onLine ne dit pas si le serveur repond, seulement si l'appareil
// a une interface active. C'est suffisant ici : le rejeu echoue proprement
// et remet la pose en file si la connexion est en trompe-l'oeil.

import { useEffect, useState } from 'react';
import { pendingCount } from '../../lib/queue.js';
import { flushQueue } from './useShot.js';

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const count = await pendingCount();
      if (!cancelled) setQueued(count);
    };

    const goOnline = async () => {
      setOnline(true);
      await flushQueue();
      await refresh();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    void refresh();

    // Le retour d'arriere-plan compte autant qu'un evenement online : un
    // telephone verrouille pendant une heure ne declenche pas toujours online.
    const onVisible = () => { if (document.visibilityState === 'visible' && navigator.onLine) void goOnline(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { online, queued, refreshQueued: async () => setQueued(await pendingCount()) };
}

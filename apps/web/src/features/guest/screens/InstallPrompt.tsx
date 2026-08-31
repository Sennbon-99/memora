// apps/web/src/features/guest/screens/InstallPrompt.tsx
// Proposition d'ajout a l'ecran d'accueil.
//
// Deux chemins parce que les deux systemes ne se ressemblent pas :
//   - Android expose beforeinstallprompt, un vrai bouton est possible
//   - iOS n'expose rien, il faut decrire le geste a la main
// Sur iOS, cet ajout n'est pas cosmetique : les notifications de publication
// ne fonctionnent que depuis une application installee.

import { useEffect, useState } from 'react';
import { Button } from '../../../ui/Button.js';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Vrai si la page tourne deja depuis l'ecran d'accueil. */
function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed] = useState(isInstalled);

  useEffect(() => {
    const capture = (event: Event) => {
      // Sans preventDefault, le navigateur affiche sa propre banniere, au
      // moment qu'il choisit — souvent des l'arrivee.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <Button tone="ghost" full onClick={() => void deferred.prompt()}>
        Ajouter Memora à mon écran d’accueil
      </Button>
    );
  }

  if (isIOS()) {
    // Les deux mots a toucher sont portes par l'or : c'est une consigne
    // gestuelle, pas une phrase — l'oeil doit trouver les deux reperes sans
    // relire la ligne entiere.
    return (
      <p className="text-center text-xs leading-relaxed text-ink-3">
        Pour être prévenu de la publication&nbsp;: touchez{' '}
        <span className="text-a1">Partager</span>, puis
        «&nbsp;<span className="text-a1">Sur l’écran d’accueil</span>&nbsp;».
      </p>
    );
  }

  return null;
}

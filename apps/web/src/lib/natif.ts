// apps/web/src/lib/natif.ts
// Les portes par lesquelles l'application installee recoit une adresse.
//
// Sur le web, une adresse arrive par la barre du navigateur et le routeur la
// lit au chargement. L'application installee, elle, est deja ouverte — ou
// s'ouvre — quand l'adresse arrive, par l'une de deux portes : un lien
// universel, c'est-a-dire le QR code de la table scanne avec l'appareil
// photo du telephone, ou le toucher d'une notification. Sans ces deux
// ecoutes, l'application s'ouvre sur l'ecran ou elle en etait, et l'invite
// ne comprend pas pourquoi le code qu'il vient de scanner ne l'a mene nulle
// part.
//
// Rien ici ne s'execute sur le web : le navigateur fait deja ce travail.

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Le chemin a suivre pour une adresse recue, ou null si l'on ne doit pas
 * la suivre.
 *
 * Deux formes sont acceptees : un chemin deja relatif — c'est ce que
 * l'API met dans une notification — et une adresse complete sur notre
 * propre domaine, ce qu'apporte un lien universel. Toute autre adresse est
 * refusee : une application qui suit n'importe quel lien qu'on lui tend
 * ouvre n'importe quoi, et mieux vaut rester ou l'on est.
 */
export function cheminASuivre(adresse: string, origine: string): string | null {
  if (adresse.startsWith('/') && !adresse.startsWith('//')) return adresse;
  try {
    const url = new URL(adresse);
    const notre = new URL(origine);
    if (url.protocol !== 'https:' || url.host !== notre.host) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Branche les deux portes sur le routeur. A appeler une fois, au demarrage.
 *
 * Les deux evenements sont retenus par le natif jusqu'a ce qu'un ecouteur
 * les consomme : une application lancee a froid par un QR code recoit donc
 * l'adresse meme si le JavaScript n'etait pas encore charge au moment ou
 * le systeme l'a transmise. L'adresse de lancement est tout de meme relue
 * explicitement, par prudence, et la garde evite d'y aller deux fois.
 */
export function ecouterLesPortes(naviguer: (chemin: string) => void): void {
  if (!Capacitor.isNativePlatform()) return;
  const origine = import.meta.env.VITE_API_ORIGIN as string;

  let dernier: string | null = null;
  const suivre = (adresse: string | undefined) => {
    if (typeof adresse !== 'string') return;
    const chemin = cheminASuivre(adresse, origine);
    if (chemin === null || chemin === dernier) return;
    dernier = chemin;
    naviguer(chemin);
  };

  void App.addListener('appUrlOpen', ({ url }) => suivre(url));
  void App.getLaunchUrl().then((lancement) => suivre(lancement?.url));

  void PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const donnees = notification.data as { url?: unknown } | undefined;
    suivre(typeof donnees?.url === 'string' ? donnees.url : undefined);
  });
}

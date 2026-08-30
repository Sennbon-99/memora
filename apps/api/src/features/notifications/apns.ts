// apps/api/src/features/notifications/apns.ts
// Envoi de notifications au service d'Apple.
//
// Ce canal existe pour une raison unique : sur iPhone, une application web
// ne recoit aucune notification tant qu'elle n'a pas ete ajoutee a l'ecran
// d'accueil, geste que presque aucun invite ne fera. L'application installee,
// elle, en recoit. Le Web Push reste le canal par defaut partout ailleurs.
//
// Aucune bibliotheque tierce : le protocole se resume a un jeton signe en
// ES256 et a une requete HTTP/2. Une dependance de plus serait une surface
// de plus a maintenir pour trois appels.

import http2 from 'node:http2';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const HOTE_PRODUCTION = 'https://api.push.apple.com';
const HOTE_BAC_A_SABLE = 'https://api.sandbox.push.apple.com';

/** Le jeton d'autorisation reste valide une heure ; Apple refuse au-dela. */
const DUREE_JETON_MS = 50 * 60 * 1000;

let jetonEnCours: { valeur: string; expireA: number } | null = null;

/** Les quatre reglages sont fournis ensemble ou pas du tout. */
export function apnsConfigured(): boolean {
  return Boolean(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY && env.APNS_TOPIC);
}

/**
 * Jeton d'autorisation, mis en cache.
 *
 * Apple limite la frequence de renouvellement et rejette un jeton reforge
 * a chaque envoi : le cache n'est pas une optimisation mais une condition.
 */
function jetonAutorisation(): string {
  const maintenant = Date.now();
  if (jetonEnCours && jetonEnCours.expireA > maintenant) return jetonEnCours.valeur;

  const valeur = jwt.sign({}, (env.APNS_PRIVATE_KEY as string).replace(/\\n/g, '\n'), {
    algorithm: 'ES256',
    issuer: env.APNS_TEAM_ID,
    keyid: env.APNS_KEY_ID,
    expiresIn: '1h',
  });
  jetonEnCours = { valeur, expireA: maintenant + DUREE_JETON_MS };
  return valeur;
}

export interface ApnsMessage {
  title: string;
  body: string;
  /** Adresse ouverte au toucher, transmise a l'application. */
  url?: string;
}

/**
 * Envoie une notification a un appareil.
 *
 * Renvoie false si l'abonnement doit etre oublie — jeton devenu invalide,
 * application desinstallee. L'appelant s'en sert pour nettoyer la base,
 * exactement comme il le fait deja pour le Web Push.
 */
export function sendApns(deviceToken: string, message: ApnsMessage): Promise<boolean> {
  const hote = env.APNS_SANDBOX === 'true' ? HOTE_BAC_A_SABLE : HOTE_PRODUCTION;
  const client = http2.connect(hote);

  return new Promise((resolve) => {
    // Une connexion qui n'aboutit pas ne doit pas retenir la requete qui a
    // declenche l'envoi : la notification est un complement, jamais un
    // prealable a la reponse faite a l'utilisateur.
    const minuterie = setTimeout(() => {
      client.destroy();
      resolve(true);
    }, 5_000);

    const fin = (garder: boolean) => {
      clearTimeout(minuterie);
      client.close();
      resolve(garder);
    };

    client.on('error', () => fin(true));

    const requete = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jetonAutorisation()}`,
      'apns-topic': env.APNS_TOPIC as string,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    });

    let statut = 0;
    requete.on('response', (entetes) => {
      statut = Number(entetes[':status'] ?? 0);
    });
    requete.on('error', () => fin(true));
    requete.on('end', () => {
      // 410 : l'appareil n'est plus joignable, l'abonnement est perime.
      // 400 avec BadDeviceToken donne le meme verdict, sans le meme code.
      fin(statut !== 410 && statut !== 400);
    });

    requete.end(JSON.stringify({
      aps: { alert: { title: message.title, body: message.body }, sound: 'default' },
      url: message.url,
    }));
  });
}

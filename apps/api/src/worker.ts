// apps/api/src/worker.ts
// Processus separe du serveur HTTP, charge des taches qui ne doivent bloquer
// personne : fermeture des evenements a echeance et purge des medias.
//
// Pourquoi un processus distinct plutot qu'un setInterval dans le serveur :
// une purge portant sur plusieurs milliers de fichiers occupe la boucle
// d'evenements pendant plusieurs secondes. Dans le meme processus, elle
// degraderait le temps de reponse d'un invite en train de photographier.

import { prisma } from './config/prisma.js';
import { redis } from './config/redis.js';
import { closeExpiredEvents } from './features/jobs/closeEvents.job.js';
import { purgeExpiredEvents } from './features/jobs/purge.job.js';

/** La fermeture doit etre reactive : un evenement ferme avec dix minutes de retard se voit. */
const CLOSE_INTERVAL_MS = 60_000;
/** La purge n'a aucune urgence : une fois par heure suffit largement. */
const PURGE_INTERVAL_MS = 60 * 60_000;

/**
 * Execute une tache en isolant ses erreurs.
 * Une purge qui echoue ne doit pas empecher la fermeture des evenements
 * suivants : chaque tache vit sa vie.
 */
async function run(name: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (err) {
    console.error(`Echec de la tache ${name} :`, err);
  }
}

console.log('Travailleur Memora demarre');

// Premiere execution immediate, pour ne pas attendre le premier intervalle
// apres un redemarrage.
void run('fermeture', closeExpiredEvents);
void run('purge', purgeExpiredEvents);

const closeTimer = setInterval(() => void run('fermeture', closeExpiredEvents), CLOSE_INTERVAL_MS);
const purgeTimer = setInterval(() => void run('purge', purgeExpiredEvents), PURGE_INTERVAL_MS);

async function shutdown(signal: string) {
  console.log(`\n${signal} recu, arret du travailleur...`);
  clearInterval(closeTimer);
  clearInterval(purgeTimer);
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

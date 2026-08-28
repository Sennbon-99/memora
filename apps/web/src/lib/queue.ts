// apps/web/src/lib/queue.ts
// File d'attente hors ligne des photographies.
//
// Un mariage se tient souvent dans une salle de campagne ou le reseau tombe.
// Sans cette file, l'invite perdrait sa pose et son quota : le decompte est
// pris localement, le transfert est rejoue plus tard.
//
// IndexedDB et non localStorage : on stocke des fichiers binaires de plusieurs
// mega-octets, ce que localStorage ne sait pas faire.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** Une pose prise mais pas encore deposee. */
export interface PendingShot {
  /** Cle d'idempotence generee par le client : elle rend le rejeu sans danger. */
  idempotencyKey: string;
  blob: Blob;
  /** Instant reel de la prise de vue, seul faisant foi cote serveur. */
  takenAt: string;
  width: number;
  height: number;
  /** Nombre de tentatives de depot deja echouees. */
  attempts: number;
}

interface MemoraDB extends DBSchema {
  pending: { key: string; value: PendingShot };
}

let dbPromise: Promise<IDBPDatabase<MemoraDB>> | null = null;

function db(): Promise<IDBPDatabase<MemoraDB>> {
  dbPromise ??= openDB<MemoraDB>('memora', 1, {
    upgrade(database) {
      database.createObjectStore('pending', { keyPath: 'idempotencyKey' });
    },
  });
  return dbPromise;
}

/** Met une pose en attente de depot. */
export async function enqueue(shot: PendingShot): Promise<void> {
  await (await db()).put('pending', shot);
}

/** Retire une pose, une fois son depot confirme par le serveur. */
export async function dequeue(idempotencyKey: string): Promise<void> {
  await (await db()).delete('pending', idempotencyKey);
}

/** Les poses en attente, de la plus ancienne a la plus recente. */
export async function pending(): Promise<PendingShot[]> {
  const all = await (await db()).getAll('pending');
  return all.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

/** Combien de poses attendent encore : c'est ce que la pastille affiche. */
export async function pendingCount(): Promise<number> {
  return (await db()).count('pending');
}

/** Enregistre un echec, pour ne pas boucler indefiniment sur la meme pose. */
export async function markAttempt(idempotencyKey: string): Promise<number> {
  const database = await db();
  const shot = await database.get('pending', idempotencyKey);
  if (!shot) return 0;

  const attempts = shot.attempts + 1;
  await database.put('pending', { ...shot, attempts });
  return attempts;
}

/** Au-dela, la pose est abandonnee et l'invite prevenu. */
export const MAX_ATTEMPTS = 5;

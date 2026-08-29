// apps/web/src/lib/datetime.ts
// Conversion entre Date et les champs de date natifs du navigateur.
//
// Le piege corrige ici : toISOString() rend une date en UTC, alors qu'un
// champ date ou datetime-local attend l'heure LOCALE. A Paris en ete, un
// 30 aout 02:00 devient 00:00 dans le champ ; l'hote fermerait sa pellicule
// deux heures avant ce qu'il croit avoir choisi. En hiver l'ecart est d'une
// heure, ce qui rend le defaut encore plus difficile a remarquer.

const pad = (n: number) => String(n).padStart(2, '0');

/** Format attendu par un champ type="date" : AAAA-MM-JJ, en heure locale. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Format attendu par un champ type="datetime-local" : AAAA-MM-JJTHH:MM, en heure locale. */
export function toDateTimeInput(date: Date): string {
  return `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Fin de soiree proposee par defaut : deux heures du matin, le lendemain.
 * C'est l'heure ou une salle des fetes ferme, et celle que l'hote corrigera
 * le moins souvent.
 */
export function defaultClosing(from = new Date()): Date {
  const close = new Date(from);
  close.setDate(close.getDate() + 1);
  close.setHours(2, 0, 0, 0);
  return close;
}

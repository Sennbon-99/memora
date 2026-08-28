// apps/api/src/utils/object.ts

/**
 * Type d'un objet dont les proprietes facultatives ne peuvent plus valoir
 * explicitement undefined : elles sont soit absentes, soit definies.
 */
export type Compacted<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

/**
 * Retire les cles dont la valeur est undefined.
 *
 * Necessaire a cause de exactOptionalPropertyTypes, active dans le tsconfig :
 * cette option distingue "propriete absente" de "propriete presente valant
 * undefined". Zod produit la seconde forme quand un champ facultatif n'est
 * pas fourni, alors que Prisma n'accepte que la premiere.
 *
 * Plutot que de desactiver l'option — qui attrape de vraies erreurs ailleurs —
 * on nettoie l'objet a la frontiere entre les deux mondes, et le type de
 * retour traduit ce nettoyage.
 */
export function compact<T extends Record<string, unknown>>(input: T): Compacted<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Compacted<T>;
}

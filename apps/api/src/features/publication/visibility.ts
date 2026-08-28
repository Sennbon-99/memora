// apps/api/src/features/publication/visibility.ts
// Le moteur de visibilite : une seule fonction decide qui voit quelle
// photographie. Elle est pure — aucun acces a la base, aucun effet de bord —
// ce qui la rend entierement verifiable par des tests unitaires, sans
// interface ni infrastructure.
//
// C'est volontaire : la regle la plus sensible du produit est aussi la plus
// simple a prouver.

import type { PublicationScope } from '@memora/types';

/** Qui regarde. */
export type Viewer =
  /** L'hote ou un co-hote de l'evenement. */
  | { kind: 'HOST' }
  /** Un invite, identifie par sa pellicule grace au cookie de son appareil. */
  | { kind: 'GUEST'; rollId: string }
  /** Quelqu'un qui detient le lien d'album, sans pellicule sur cet evenement. */
  | { kind: 'LINK' };

export interface PhotoContext {
  /** La pellicule dont provient la photographie. */
  rollId: string;
  /** Retenue par l'hote lors de son tri. */
  published: boolean;
  /** Masquee a titre conservatoire, ou retiree definitivement. */
  hidden: boolean;
}

export interface EventContext {
  /** L'evenement a-t-il ete publie par l'hote ? */
  isPublished: boolean;
  scope: PublicationScope;
}

/**
 * Decide si une photographie est visible pour un observateur donne.
 *
 * L'ordre des regles compte : les interdictions absolues sont evaluees
 * en premier, ce qui garantit qu'aucune portee de publication ne peut
 * les contourner.
 */
export function canSeePhoto(
  event: EventContext,
  photo: PhotoContext,
  viewer: Viewer,
): boolean {
  // 1. L'hote et ses co-hotes voient tout, y compris avant publication et
  //    y compris ce qui est masque : c'est precisement leur travail de tri.
  if (viewer.kind === 'HOST') return true;

  // 2. Une photographie masquee ou retiree n'est jamais visible d'un tiers,
  //    quelle que soit la portee. Le droit a l'image prime sur le partage.
  if (photo.hidden) return false;

  // 3. Avant publication, personne d'autre que l'hote ne voit quoi que ce soit.
  //    C'est le principe meme du produit.
  if (!event.isPublished) return false;

  // 4. Une photographie que l'hote n'a pas retenue lors de son tri reste privee.
  if (!photo.published) return false;

  // 5. Enfin seulement, la portee choisie par l'hote s'applique.
  switch (event.scope) {
    case 'NONE':
      // L'hote a publie sans partager : il garde l'album pour lui.
      return false;

    case 'EVERYONE':
      // Tous les invites, et toute personne detenant le lien.
      return true;

    case 'SELECTED':
      // Acces reserve aux detenteurs du lien, protege par un code verifie
      // en amont. Un invite sans le lien ne voit rien de plus qu'un tiers.
      return viewer.kind === 'LINK';

    case 'OWN_ONLY':
      // Chacun ne voit que sa propre pellicule. Un detenteur du lien qui
      // n'a pas participe ne voit donc rien.
      return viewer.kind === 'GUEST' && viewer.rollId === photo.rollId;
  }
}

/**
 * Filtre une liste de photographies pour un observateur.
 * Enveloppe pratique autour de canSeePhoto, utilisee par le service.
 */
export function filterVisible<T extends PhotoContext>(
  event: EventContext,
  photos: T[],
  viewer: Viewer,
): T[] {
  return photos.filter((photo) => canSeePhoto(event, photo, viewer));
}

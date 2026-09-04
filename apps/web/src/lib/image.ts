// apps/web/src/lib/image.ts
// Preparation du fichier avant depot.
//
// Deux traitements, dans cet ordre : reduction de taille, puis effacement
// des metadonnees. Le second est une exigence du RGPD — une photographie de
// telephone contient les coordonnees GPS du lieu et le modele de l'appareil.
// Les effacer ici, et non sur le serveur, veut dire qu'elles ne quittent
// jamais le telephone.

/** Cote le plus long apres reduction. Suffisant pour un tirage 10x15. */
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Dimensions de sortie, en conservant les proportions. */
export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * Fenetre de recadrage centree, au rapport demande.
 *
 * Le viseur affiche le flux en object-cover, qui rogne exactement ainsi :
 * en refaisant le meme calcul au moment de la capture, la photographie
 * enregistree est celle que l'invite avait sous les yeux. C'est la seule
 * facon d'obtenir cette garantie — les contraintes de getUserMedia sont des
 * souhaits, chaque navigateur les honore a sa maniere.
 */
export function cropBox(width: number, height: number, ratio: number) {
  const current = width / height;
  // Une tolerance, sinon un flux deja au bon format serait recadre d'un pixel
  // a chaque pose, pour rien.
  if (Math.abs(current - ratio) < 0.01) return { x: 0, y: 0, width, height };

  if (current > ratio) {
    const kept = Math.round(height * ratio);
    return { x: Math.round((width - kept) / 2), y: 0, width: kept, height };
  }

  const kept = Math.round(width / ratio);
  return { x: 0, y: Math.round((height - kept) / 2), width, height: kept };
}

/**
 * Redessine l'image dans un canvas, puis la re-encode.
 *
 * L'effacement des metadonnees n'est pas une operation explicite : le canvas
 * ne connait que des pixels. Tout ce qui n'est pas un pixel — GPS, modele
 * d'appareil, date de prise de vue du capteur — disparait a la reconstruction.
 */
export async function prepare(source: Blob | ImageBitmap, ratio?: number): Promise<PreparedImage> {
  const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
  const box = ratio
    ? cropBox(bitmap.width, bitmap.height, ratio)
    : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const { width, height } = scaledSize(box.width, box.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible');

  context.drawImage(bitmap, box.x, box.y, box.width, box.height, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('Encodage impossible');

  return { blob, width, height };
}

/** Adresse locale d'apercu. A liberer avec revokeObjectURL apres usage. */
export function previewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

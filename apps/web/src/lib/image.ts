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
 * Redessine l'image dans un canvas, puis la re-encode.
 *
 * L'effacement des metadonnees n'est pas une operation explicite : le canvas
 * ne connait que des pixels. Tout ce qui n'est pas un pixel — GPS, modele
 * d'appareil, date de prise de vue du capteur — disparait a la reconstruction.
 */
export async function prepare(source: Blob | ImageBitmap): Promise<PreparedImage> {
  const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
  const { width, height } = scaledSize(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible');

  context.drawImage(bitmap, 0, 0, width, height);
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

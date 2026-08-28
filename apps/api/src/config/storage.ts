// apps/api/src/config/storage.ts
// Acces au stockage objet MinIO, compatible avec l'interface S3.
//
// Regle du projet : le fichier ne transite jamais par l'API. Celle-ci se
// contente de delivrer une adresse signee a duree limitee, et le navigateur
// envoie directement vers le stockage. L'API autorise, puis elle constate.

import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  // Indispensable avec MinIO : l'adresse est http://host/bucket/objet
  // et non http://bucket.host/objet comme chez Amazon.
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

/** Duree de validite d'une adresse d'envoi : le temps d'un transfert, pas plus. */
const UPLOAD_TTL_SECONDS = 300;
/** Duree de validite d'une adresse de lecture : le temps de consulter un album. */
const READ_TTL_SECONDS = 900;

/** Chemin d'un objet : un dossier par evenement, un sous-dossier par pellicule. */
export function buildObjectKey(eventId: string, rollId: string, uuid: string): string {
  return `${eventId}/${rollId}/${uuid}.jpg`;
}

/** Adresse d'envoi, remise au client apres reservation de la pose. */
export function signUpload(objectKey: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, ContentType: 'image/jpeg' }),
    { expiresIn: UPLOAD_TTL_SECONDS },
  );
}

/** Adresse de lecture, delivree seulement apres controle des droits. */
export function signRead(objectKey: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }),
    { expiresIn: READ_TTL_SECONDS },
  );
}

/** Suppression definitive, utilisee par la purge a trente jours. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}

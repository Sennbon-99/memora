// apps/api/prisma/seed.ts
// Jeu de donnees de demonstration.
//
// Il reproduit un evenement reel de taille moyenne : un mariage ferme, avec
// des pellicules a differents stades, des moments forts et une demande de
// retrait en attente. C'est ce jeu qui sert aux essais manuels et aux
// captures d'ecran du dossier.

// Le seed est lance hors de l'application : personne n'a charge le .env
// avant lui, il doit le faire lui-meme et avant d'instancier le client.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import { s3 } from '../src/config/storage.js';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

/**
 * Depot des fichiers de demonstration dans le stockage objet.
 *
 * Sans eux, la base contient des enregistrements dont l'adresse signee ne
 * pointe sur rien : les ecrans de tri et d'album affichent des images
 * cassees. Les fichiers sont des images de synthese generees pour ce jeu
 * de donnees, sans droits a verifier.
 */
const DOSSIER_PHOTOS = join(dirname(fileURLToPath(import.meta.url)), 'photos');

async function chargerImages(): Promise<Buffer[]> {
  const noms = (await readdir(DOSSIER_PHOTOS)).filter((nom) => nom.endsWith('.jpg')).sort();
  return Promise.all(noms.map((nom) => readFile(join(DOSSIER_PHOTOS, nom))));
}

/** Decale une date de n heures par rapport a maintenant. */
const hours = (n: number) => new Date(Date.now() + n * 3_600_000);

async function main() {
  console.log('Nettoyage des donnees existantes...');
  // L'ordre suit les dependances : on part des feuilles vers la racine.
  await prisma.removalRequest.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.roll.deleteMany();
  await prisma.moment.deleteMany();
  await prisma.eventTable.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.coHost.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creation des comptes...');
  const passwordHash = await bcrypt.hash('memora-demo-2026', 12);

  const lea = await prisma.user.create({
    data: { email: 'lea@memora.test', name: 'Lea Marchand', passwordHash },
  });
  const temoin = await prisma.user.create({
    data: { email: 'temoin@memora.test', name: 'Sonia Vidal', passwordHash },
  });

  console.log('Creation de l evenement...');
  const mariage = await prisma.event.create({
    data: {
      name: 'Mariage de Lea et Sam',
      slug: 'mariage-de-lea-et-sam-demo01',
      joinCode: 'DEMO24',
      type: 'MARIAGE',
      eventDate: hours(-12),
      quotaShots: 24,
      closesAt: hours(-2), // ferme il y a deux heures
      previewMode: 'NONE',
      color: '#B0741C',
      welcomeMessage: 'Photographiez les gens que je n aurai pas le temps de voir.',
      useTableCodes: true,
      state: 'CLOSED',
      ownerId: lea.id,
      coHosts: { create: { userId: temoin.id } },
    },
  });

  console.log('Creation des tables...');
  const tables = await Promise.all(
    ['Table 1', 'Table 2', 'Table 3', 'Table 4'].map((label) =>
      prisma.eventTable.create({
        data: { eventId: mariage.id, label, qrToken: randomUUID().slice(0, 12) },
      }),
    ),
  );

  console.log('Creation des moments forts...');
  const [cocktail, bal] = await Promise.all([
    prisma.moment.create({
      data: {
        eventId: mariage.id, label: 'Cocktail', plannedAt: hours(-11),
        startedAt: hours(-11), durationMinutes: 10, bonusShots: 3,
      },
    }),
    prisma.moment.create({
      data: {
        eventId: mariage.id, label: 'Ouverture du bal', plannedAt: hours(-6),
        startedAt: hours(-6), durationMinutes: 10, bonusShots: 3,
      },
    }),
  ]);

  console.log('Chargement des images de demonstration...');
  const images = await chargerImages();
  if (images.length === 0) throw new Error('Aucune image dans prisma/photos');

  console.log('Creation des pellicules et des photographies...');
  const prenoms = ['Camille', 'Robert', 'Marc', 'Sonia', null, 'Julien', null, 'Ines'];

  for (const [index, firstName] of prenoms.entries()) {
    const table = tables[index % tables.length]!;
    const used = 4 + ((index * 3) % 18); // entre 4 et 21 poses consommees

    const roll = await prisma.roll.create({
      data: {
        eventId: mariage.id,
        deviceToken: randomUUID(),
        firstName,
        consentedAt: hours(-11.5),
        shotsLeft: 24 - used,
        tableId: table.id,
      },
    });

    // Les photographies sont reparties : quelques-unes pendant les moments
    // forts, le reste au fil de la soiree.
    for (let i = 0; i < used; i += 1) {
      const duringMoment = i < 3 ? cocktail.id : i < 6 ? bal.id : null;
      const objectKey = `${mariage.id}/${roll.id}/${randomUUID()}.jpg`;

      // Le fichier part avant l'enregistrement : une photographie en base
      // dont le fichier manque produirait une image cassee a l'ecran, ce
      // qui est pire qu'une photographie absente.
      const image = images[(index * 7 + i) % images.length]!;
      await s3.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET, Key: objectKey, Body: image, ContentType: 'image/jpeg',
      }));

      await prisma.photo.create({
        data: {
          objectKey,
          idempotencyKey: randomUUID(),
          takenAt: hours(-11 + i * 0.4),
          uploadedAt: hours(-11 + i * 0.4),
          status: 'UPLOADED',
          // Rien n'est publie : le jeu de donnees represente une soiree qui
          // vient de fermer, ou tout reste a trier. Pre-publier rendrait le
          // parcours de tri et de publication indemontrable.
          published: false,
          width: 1200, height: 1600, sizeBytes: image.length,
          rollId: roll.id,
          momentId: duringMoment,
        },
      });
    }
  }

  console.log('Creation d une demande de retrait en attente...');
  const anyPhoto = await prisma.photo.findFirst({ where: { status: 'UPLOADED' } });
  const anyRoll = await prisma.roll.findFirst({ where: { firstName: 'Robert' } });
  if (anyPhoto && anyRoll) {
    await prisma.removalRequest.create({
      data: {
        photoId: anyPhoto.id,
        rollId: anyRoll.id,
        reason: 'Je prefere ne pas apparaitre sur cette photographie.',
      },
    });
    await prisma.photo.update({ where: { id: anyPhoto.id }, data: { status: 'HIDDEN' } });
  }

  const counts = {
    pellicules: await prisma.roll.count(),
    photographies: await prisma.photo.count(),
    moments: await prisma.moment.count(),
    demandes: await prisma.removalRequest.count(),
  };

  console.log('\nJeu de donnees pret :', counts);
  console.log('Connexion : lea@memora.test / memora-demo-2026');
}

main()
  .catch((err) => {
    console.error('Echec du seed :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

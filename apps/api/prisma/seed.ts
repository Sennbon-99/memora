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
import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
      await prisma.photo.create({
        data: {
          objectKey: `${mariage.id}/${roll.id}/${randomUUID()}.jpg`,
          idempotencyKey: randomUUID(),
          takenAt: hours(-11 + i * 0.4),
          uploadedAt: hours(-11 + i * 0.4),
          status: 'UPLOADED',
          published: index < 5, // l hote a retenu les cinq premieres pellicules
          width: 3024, height: 4032, sizeBytes: 2_800_000,
          rollId: roll.id,
          momentId: duringMoment,
        },
      });
    }
  }

  console.log('Creation d une demande de retrait en attente...');
  const anyPhoto = await prisma.photo.findFirst({ where: { published: true } });
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

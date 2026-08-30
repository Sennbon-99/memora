// apps/api/scripts/repetition.ts
// Repetition generale : une soiree entiere jouee a travers l'API publique.
//
// Ce script n'est pas un jeu de donnees, c'est un essai de bout en bout. Il
// n'ecrit jamais dans la base directement : il appelle les memes adresses
// que le navigateur, avec les memes cookies, dans le meme ordre. Tout ce
// qui casserait pour un vrai invite casse ici.
//
// Il sert a deux choses : verifier que la chaine complete tient, et laisser
// derriere lui une soiree dans un etat coherent pour les captures d'ecran
// du dossier.

import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.API_URL ?? 'http://localhost:3000/api';
const PHOTOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'photos');

/** Un client HTTP qui garde ses cookies, comme le ferait un navigateur. */
class Client {
  private cookies = new Map<string, string>();
  accessToken: string | null = null;

  private header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  private remember(response: Response) {
    // set-cookie n'est expose qu'a travers getSetCookie : une simple
    // lecture de l'en-tete ne rendrait que le premier cookie.
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const separator = pair!.indexOf('=');
      if (separator > 0) {
        this.cookies.set(pair!.slice(0, separator), pair!.slice(separator + 1));
      }
    }
  }

  async call<T>(path: string, init: RequestInit & { body?: unknown } = {}): Promise<T> {
    const { body, ...rest } = init;
    const response = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookies.size ? { Cookie: this.header() } : {}),
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        ...rest.headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    this.remember(response);

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} → ${response.status} ${text.slice(0, 160)}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

const PRENOMS = ['Camille', 'Marc', null, 'Sonia', 'Julien', null, 'Inès', 'Robert'];
const attendre = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const images = await Promise.all(
    (await readdir(PHOTOS)).filter((nom) => nom.endsWith('.jpg')).sort()
      .map((nom) => readFile(join(PHOTOS, nom))),
  );
  console.log(`${images.length} images chargees`);

  // --- 1. L'hote ------------------------------------------------------
  const hote = new Client();
  const email = `repetition-${Date.now()}@memora.test`;
  const { accessToken } = await hote.call<{ accessToken: string }>('/auth/register', {
    method: 'POST',
    body: { email, password: 'repetition-2026-memora', name: 'Léa Marchand' },
  });
  hote.accessToken = accessToken;
  console.log('Compte cree');

  const closesAt = new Date(Date.now() + 4 * 3600_000);
  const { event } = await hote.call<{ event: { id: string; slug: string } }>('/events', {
    method: 'POST',
    body: {
      name: 'Mariage de Léa & Tom', type: 'MARIAGE',
      eventDate: new Date(), closesAt, quotaShots: 24,
      previewMode: 'BLURRED', color: '#C97C1E', useTableCodes: true,
      welcomeMessage: 'Photographiez ce que nous ne verrons pas.',
    },
  });
  console.log(`Soiree creee : ${event.slug}`);

  // Les tables portent leurs propres QR codes, et surtout : le champ que
  // l'invite remplit attend l'identifiant d'une table existante.
  const { tables } = await hote.call<{ tables: { id: string; label: string }[] }>(
    `/events/${event.id}/tables`,
    { method: 'POST', body: { labels: ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6'] } },
  );
  console.log(`${tables.length} tables creees`);

  await hote.call(`/events/${event.id}/open`, { method: 'POST' });
  console.log('Pellicule ouverte');

  // Un moment fort prepare avant la soiree, comme le ferait un vrai hote.
  const { moment } = await hote.call<{ moment: { id: string } }>(
    `/events/${event.id}/moments`,
    { method: 'POST', body: { label: 'Ouverture du bal', durationMinutes: 15, bonusShots: 5 } },
  );

  // --- 2. Les invites -------------------------------------------------
  const invites: { client: Client; prenom: string | null; prises: number }[] = [];

  for (const [index, prenom] of PRENOMS.entries()) {
    const invite = new Client();
    await invite.call(`/e/${event.slug}`);
    await invite.call(`/e/${event.slug}/consent`, { method: 'POST', body: { accepted: true } });
    // Chacun choisit sa table, comme le fera un vrai invite.
    const table = tables[index % tables.length]!;
    if (prenom) {
      await invite.call(`/e/${event.slug}/identity`, {
        method: 'POST', body: { firstName: prenom, tableId: table.id },
      });
    } else {
      await invite.call(`/e/${event.slug}/identity`, {
        method: 'POST', body: { tableId: table.id },
      });
    }
    invites.push({ client: invite, prenom, prises: 0 });
    process.stdout.write(`\rInvites arrives : ${index + 1}/${PRENOMS.length}`);
  }
  console.log('');

  /** Une prise de vue complete : reservation, depot, confirmation. */
  async function photographier(invite: typeof invites[number], quand: Date) {
    const image = images[Math.floor(Math.random() * images.length)]!;
    const cle = crypto.randomUUID();

    const reservation = await invite.client.call<{ uploadUrl: string }>('/photos/reserve', {
      method: 'POST',
      body: {
        idempotencyKey: cle, takenAt: quand,
        width: 1200, height: 1600, sizeBytes: image.length,
      },
    });

    const depot = await fetch(reservation.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(image),
    });
    if (!depot.ok) {
      // On expose l origine signee et la reponse du stockage : un 404 vient
      // presque toujours d une adresse mal composee, pas du contenu envoye.
      const detail = await depot.text().catch(() => '');
      throw new Error(
        `Depot refuse : ${depot.status} sur ${new URL(reservation.uploadUrl).origin}\n${detail.slice(0, 400)}`,
      );
    }

    await invite.client.call('/photos/confirm', { method: 'POST', body: { idempotencyKey: cle } });
    invite.prises += 1;
  }

  // Debut de soiree : chacun photographie a son rythme.
  const debut = Date.now() - 3 * 3600_000;
  for (const [rang, invite] of invites.entries()) {
    const combien = 4 + ((rang * 3) % 9);
    for (let i = 0; i < combien; i += 1) {
      await photographier(invite, new Date(debut + i * 240_000 + rang * 60_000));
    }
    process.stdout.write(`\rPhotographies deposees : ${invites.reduce((n, g) => n + g.prises, 0)}`);
  }
  console.log('');

  // --- 3. Le moment fort ----------------------------------------------
  await hote.call(`/events/${event.id}/moments/${moment.id}/trigger`, { method: 'POST' });
  console.log('Moment fort declenche');
  await attendre(300);

  for (const invite of invites.slice(0, 5)) {
    for (let i = 0; i < 3; i += 1) {
      await photographier(invite, new Date(Date.now() - 60_000 + i * 10_000));
    }
  }
  console.log(`Photographies du moment : 15`);
  await hote.call(`/events/${event.id}/moments/${moment.id}/close`, { method: 'POST' });

  // --- 4. Fermeture, tri, publication ---------------------------------
  await hote.call(`/events/${event.id}/close`, { method: 'POST' });
  console.log('Pellicule fermee');

  const { rolls } = await hote.call<{ rolls: { id: string; photos: number }[] }>(
    `/events/${event.id}/rolls`,
  );

  // L'hote trie les trois premieres pellicules et en ecarte quelques-unes :
  // un album entierement garde ne montrerait pas que le tri sert a quelque
  // chose.
  for (const roll of rolls.slice(0, 3)) {
    const { photos } = await hote.call<{ photos: { id: string }[] }>(
      `/events/${event.id}/rolls/${roll.id}/photos`,
    );
    const ecartees = photos.filter((_, index) => index % 5 === 0).map((photo) => photo.id);
    await hote.call(`/events/${event.id}/rolls/${roll.id}/review`, {
      method: 'POST', body: { hiddenPhotoIds: ecartees },
    });
    console.log(`  ${roll.id.slice(-6)} : ${photos.length - ecartees.length} gardees, ${ecartees.length} ecartees`);
  }

  const publication = await hote.call<{ publishedNow: number; pending: number }>(
    `/events/${event.id}/publish-reviewed`,
    { method: 'POST', body: { scope: 'EVERYONE' } },
  );
  console.log(`Publie : ${publication.publishedNow} photographies, ${publication.pending} pellicules restent a trier`);

  const stats = await hote.call<Record<string, unknown>>(`/events/${event.id}/stats`);
  console.log('\nSoiree prete pour les captures');
  console.log(`  hote      : ${email} / repetition-2026-memora`);
  console.log(`  invite    : /e/${event.slug}`);
  console.log(`  tableau   : /hote/${event.id}`);
  console.log(`  statistiques :`, stats);
}

main().catch((error) => {
  console.error('\nEchec de la repetition :', error instanceof Error ? error.message : error);
  process.exit(1);
});

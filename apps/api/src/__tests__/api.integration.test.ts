// apps/api/src/__tests__/api.integration.test.ts
// Tests d'integration de l'API.
//
// Ils attaquent l'application Express reelle avec Supertest, sans ouvrir de
// port : c'est pour cela que app.ts exporte createApp() sans ecouter. On y
// verifie ce que les tests unitaires ne voient pas — le routage, les codes
// de statut, la validation d'entree et les middlewares d'autorisation.
//
// Prisma, Redis et le stockage restent remplaces par des doubles : ces tests
// portent sur la chaine HTTP, pas sur l'infrastructure.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';

const userFindUnique = vi.fn();
const userCreate = vi.fn();
const eventFindUnique = vi.fn();
const eventFindMany = vi.fn();
const eventCount = vi.fn();
const eventCreate = vi.fn();
const rollFindUnique = vi.fn();
const queryRaw = vi.fn();

vi.mock('../config/prisma.js', () => ({
  prisma: {
    user: { findUnique: userFindUnique, create: userCreate },
    event: { findUnique: eventFindUnique, findMany: eventFindMany, count: eventCount, create: eventCreate },
    roll: { findUnique: rollFindUnique },
    photo: {}, moment: {}, payment: {}, removalRequest: {}, eventTable: {},
    $queryRaw: queryRaw,
    $transaction: vi.fn(),
  },
}));

const ping = vi.fn();
vi.mock('../config/redis.js', () => ({
  redis: { ping, on: vi.fn() },
  consumeShot: vi.fn(), refundShot: vi.fn(), initQuota: vi.fn(),
  readQuota: vi.fn(), readBonusQuota: vi.fn().mockResolvedValue(0), grantBonusShots: vi.fn(),
  quotaKey: (id: string) => `quota:${id}`, bonusKey: (id: string) => `bonus:${id}`,
}));

vi.mock('../config/storage.js', () => ({
  signUpload: vi.fn(), signRead: vi.fn(), deleteObjects: vi.fn(),
  buildObjectKey: () => 'k', s3: {},
}));

const { createApp } = await import('../app.js');
const { signAccessToken } = await import('../utils/jwt.js');
const { hashPassword } = await import('../utils/hash.js');

const app = createApp();
const hote = { id: 'u1', email: 'lea@test.fr', name: 'Lea', role: 'HOST' as const };
const jeton = () => `Bearer ${signAccessToken({ userId: 'u1', role: 'HOST' })}`;

beforeEach(() => {
  [userFindUnique, userCreate, eventFindUnique, eventFindMany, eventCount,
   eventCreate, rollFindUnique, queryRaw, ping].forEach((m) => m.mockReset());
});

describe('GET /health', () => {
  it('repond 200 quand la base et Redis repondent', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    ping.mockResolvedValue('PONG');

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('repond 503 quand la base est injoignable', async () => {
    queryRaw.mockRejectedValue(new Error('connexion refusee'));

    const res = await request(app).get('/health');

    // C'est cette reponse que Coolify interroge avant de basculer le trafic :
    // un 503 annule le deploiement au lieu de mettre une version cassee en ligne.
    expect(res.status).toBe(503);
  });
});

describe('validation des entrees', () => {
  it('renvoie 422 et le detail des champs fautifs', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'pas-une-adresse', password: 'court', name: 'A' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    // Les trois champs sont signales d'un coup, pas un par un.
    expect(Object.keys(res.body.fields)).toEqual(
      expect.arrayContaining(['email', 'password', 'name']),
    );
  });

  it('accompagne chaque erreur d un identifiant de correlation', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x', password: '' });
    expect(res.body.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('authentification', () => {
  it('depose le jeton de renouvellement dans un cookie inaccessible au script', async () => {
    userFindUnique.mockResolvedValue({
      id: 'u1', email: 'lea@test.fr', name: 'Lea', role: 'HOST',
      passwordHash: await hashPassword('motdepasse123'),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lea@test.fr', password: 'motdepasse123' });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']![0]!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    // Le cookie n'est envoye que sur la route de renouvellement.
    expect(cookie).toContain('Path=/api/auth/refresh');
    // Le jeton d'acces, lui, passe par le corps : le navigateur ne l'ajoutera
    // jamais tout seul a une requete forgee depuis un autre site.
    expect(res.body.accessToken).toBeTruthy();
  });

  it('renvoie 401 sur identifiants incorrects', async () => {
    userFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@test.fr', password: 'motdepasse123' });

    expect(res.status).toBe(401);
  });
});

describe('autorisations', () => {
  it('refuse une route protegee sans jeton', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('refuse un jeton falsifie', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.faux.signature');

    expect(res.status).toBe(401);
  });

  it('refuse un jeton valide dont le compte n existe plus', async () => {
    // Le middleware recharge l'utilisateur : un compte supprime ne passe plus,
    // meme avec un jeton emis quinze minutes plus tot.
    userFindUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/events').set('Authorization', jeton());

    expect(res.status).toBe(401);
  });

  it('accepte un jeton valide et un compte existant', async () => {
    userFindUnique.mockResolvedValue(hote);
    eventFindMany.mockResolvedValue([]);

    const res = await request(app).get('/api/events').set('Authorization', jeton());

    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
  });
});

describe('parcours invite', () => {
  it('renvoie 404 sur un evenement inconnu, sans reveler quoi que ce soit', async () => {
    eventFindUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/e/slug-inexistant');

    expect(res.status).toBe(404);
  });

  it('refuse la reservation d une pose sans pellicule ouverte', async () => {
    const res = await request(app)
      .post('/api/photos/reserve')
      .send({ idempotencyKey: '11111111-1111-4111-8111-111111111111' });

    expect(res.status).toBe(401);
  });

  it('refuse la prise de vue tant que le consentement n est pas donne', async () => {
    const { signDeviceToken } = await import('../utils/jwt.js');
    rollFindUnique.mockResolvedValue({
      id: 'r1', eventId: 'e1', consentedAt: null, shotsLeft: 24, bonusShots: 0, tableId: null,
    });

    const res = await request(app)
      .post('/api/photos/reserve')
      .set('Cookie', [`memora_device=${signDeviceToken('r1')}`])
      .send({
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        takenAt: new Date().toISOString(), width: 100, height: 100, sizeBytes: 1000,
      });

    // C'est la regle RG-04 du dossier, verifiee cote serveur et non par l'interface.
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONSENT_REQUIRED');
  });
});

describe('en-tetes de securite', () => {
  it('pose les en-tetes de Helmet', async () => {
    queryRaw.mockResolvedValue([]);
    ping.mockResolvedValue('PONG');

    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    // La version du serveur ne doit pas etre annoncee.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('fait confiance a un seul relais pour identifier le client', () => {
    // En production, Traefik se trouve devant l'application et pose
    // X-Forwarded-For. Sans confiance declaree, Express ignore l'en-tete :
    // la limitation de debit voit alors toutes les requetes venir du relais
    // et un seul visiteur epuise le quota de tout le monde.
    //
    // La valeur doit rester 1. Passer a true laisserait un client forger
    // l'en-tete et se donner une adresse neuve a chaque requete.
    expect(app.get('trust proxy')).toBe(1);
  });
});

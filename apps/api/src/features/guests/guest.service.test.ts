// apps/api/src/features/guests/guest.service.test.ts
// Tests du parcours invite : ouverture de pellicule, plafond, consentement,
// recuperation par code.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const eventFindUnique = vi.fn();
const rollFindFirst = vi.fn();
const rollFindUnique = vi.fn();
const rollFindMany = vi.fn();
const rollCreate = vi.fn();
const rollUpdate = vi.fn();
const readQuota = vi.fn();
const initQuota = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    event: { findUnique: eventFindUnique },
    roll: {
      findFirst: rollFindFirst, findUnique: rollFindUnique,
      findMany: rollFindMany, create: rollCreate, update: rollUpdate,
    },
  },
}));

vi.mock('../../config/redis.js', () => ({ readQuota, initQuota }));

const { joinEvent, giveConsent, recoverRoll } = await import('./guest.service.js');
const { hashRecoveryCode } = await import('../../utils/hash.js');
const { signDeviceToken } = await import('../../utils/jwt.js');

const openEvent = {
  id: 'e1', name: 'Mariage de Lea et Sam', state: 'OPEN', quotaShots: 24,
  previewMode: 'NONE', color: '#B0741C', welcomeMessage: null,
  closesAt: new Date('2026-09-01'), useTableCodes: false,
  _count: { rolls: 12 },
};

beforeEach(() => {
  [eventFindUnique, rollFindFirst, rollFindUnique, rollFindMany, rollCreate, rollUpdate, readQuota, initQuota]
    .forEach((m) => m.mockReset());
});

describe('joinEvent', () => {
  it('ouvre une pellicule neuve et initialise le compteur de poses', async () => {
    eventFindUnique.mockResolvedValue(openEvent);
    rollCreate.mockResolvedValue({
      id: 'r1', firstName: null, shotsLeft: 24, bonusShots: 0, consentedAt: null,
    });

    const session = await joinEvent('mariage-x', undefined);

    expect(session.roll.shotsLeft).toBe(24);
    expect(session.roll.hasConsented).toBe(false);
    expect(initQuota).toHaveBeenCalledWith('r1', 24);
  });

  it('restaure la pellicule existante sans en creer une seconde', async () => {
    eventFindUnique.mockResolvedValue(openEvent);
    rollFindFirst.mockResolvedValue({
      id: 'r1', firstName: 'Camille', shotsLeft: 24, bonusShots: 0, consentedAt: new Date(),
    });
    readQuota.mockResolvedValue(17); // Redis fait foi pendant l'evenement

    const session = await joinEvent('mariage-x', signDeviceToken('r1'));

    expect(session.roll.shotsLeft).toBe(17);
    expect(session.roll.hasConsented).toBe(true);
    expect(rollCreate).not.toHaveBeenCalled();
  });

  it('traite un cookie falsifie comme un appareil inconnu', async () => {
    eventFindUnique.mockResolvedValue(openEvent);
    rollCreate.mockResolvedValue({
      id: 'r2', firstName: null, shotsLeft: 24, bonusShots: 0, consentedAt: null,
    });

    // Un jeton invalide ne doit pas lever : il ouvre simplement une pellicule.
    await expect(joinEvent('mariage-x', 'jeton.completement.invalide')).resolves.toBeTruthy();
    expect(rollCreate).toHaveBeenCalled();
  });

  it('refuse au-dela de deux cents participants', async () => {
    eventFindUnique.mockResolvedValue({ ...openEvent, _count: { rolls: 200 } });
    await expect(joinEvent('mariage-x', undefined)).rejects.toMatchObject({ code: 'EVENT_FULL' });
  });

  it('refuse un nouvel arrivant sur un evenement ferme', async () => {
    eventFindUnique.mockResolvedValue({ ...openEvent, state: 'CLOSED' });
    await expect(joinEvent('mariage-x', undefined)).rejects.toMatchObject({ code: 'EVENT_CLOSED' });
  });

  it('laisse revenir un invite qui a deja sa pellicule apres la fermeture', async () => {
    // Sans cela, l'invite ne pourrait jamais voir son album : la soiree est
    // fermee au moment ou l'hote publie. Le refus ne vise que les nouveaux
    // arrivants, pas ceux qui etaient la.
    eventFindUnique.mockResolvedValue({ ...openEvent, state: 'PUBLISHED' });
    rollFindFirst.mockResolvedValue({
      id: 'r1', firstName: 'Camille', shotsLeft: 0, bonusShots: 0, consentedAt: new Date(),
    });

    const session = await joinEvent('mariage-x', signDeviceToken('r1'));

    expect(session.roll.id).toBe('r1');
    expect(session.event.albumPublished).toBe(true);
    expect(rollCreate).not.toHaveBeenCalled();
  });

  it('traite une soiree purgee comme un lien mort', async () => {
    eventFindUnique.mockResolvedValue({ ...openEvent, state: 'PURGED' });
    await expect(joinEvent('mariage-x', signDeviceToken('r1')))
      .rejects.toMatchObject({ code: 'EVENT_CLOSED' });
  });

  it('traite un evenement en brouillon comme inexistant', async () => {
    // On ne revele pas qu'un evenement est en preparation : il est introuvable.
    eventFindUnique.mockResolvedValue({ ...openEvent, state: 'DRAFT' });
    await expect(joinEvent('mariage-x', undefined)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('giveConsent', () => {
  it('horodate le consentement', async () => {
    rollFindUnique.mockResolvedValue({ id: 'r1', consentedAt: null });
    rollUpdate.mockResolvedValue({ consentedAt: new Date('2026-08-15T20:00:00Z') });

    const { consentedAt } = await giveConsent('r1');
    expect(consentedAt).toBeInstanceOf(Date);
  });

  it('ne rehorodate pas un consentement deja donne', async () => {
    const premiere = new Date('2026-08-15T20:00:00Z');
    rollFindUnique.mockResolvedValue({ id: 'r1', consentedAt: premiere });

    const { consentedAt } = await giveConsent('r1');

    // C'est la date du premier accord qui fait foi, pas celle du dernier clic.
    expect(consentedAt).toEqual(premiere);
    expect(rollUpdate).not.toHaveBeenCalled();
  });
});

describe('recoverRoll', () => {
  it('retrouve la pellicule avec le bon prenom et le bon code', async () => {
    eventFindUnique.mockResolvedValue({ id: 'e1' });
    rollFindMany.mockResolvedValue([
      { id: 'r1', recoveryHash: await hashRecoveryCode('4702') },
    ]);

    const { rollId } = await recoverRoll('mariage-x', { firstName: 'Camille', code: '4702' });
    expect(rollId).toBe('r1');
  });

  it('distingue deux invites portant le meme prenom', async () => {
    eventFindUnique.mockResolvedValue({ id: 'e1' });
    rollFindMany.mockResolvedValue([
      { id: 'r1', recoveryHash: await hashRecoveryCode('1111') },
      { id: 'r2', recoveryHash: await hashRecoveryCode('2222') },
    ]);

    const { rollId } = await recoverRoll('mariage-x', { firstName: 'Camille', code: '2222' });
    expect(rollId).toBe('r2');
  });

  it('renvoie la meme erreur pour un prenom inconnu et un code faux', async () => {
    eventFindUnique.mockResolvedValue({ id: 'e1' });

    rollFindMany.mockResolvedValue([]);
    const prenomInconnu = await recoverRoll('m', { firstName: 'X', code: '1111' }).catch((e) => e);

    rollFindMany.mockResolvedValue([{ id: 'r1', recoveryHash: await hashRecoveryCode('9999') }]);
    const codeFaux = await recoverRoll('m', { firstName: 'Camille', code: '1111' }).catch((e) => e);

    expect(prenomInconnu.code).toBe(codeFaux.code);
    expect(prenomInconnu.message).toBe(codeFaux.message);
  });
});

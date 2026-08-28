// apps/api/src/features/notifications/push.service.test.ts

import { describe, expect, it, vi, beforeEach } from 'vitest';

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock('web-push', () => ({ default: { sendNotification, setVapidDetails } }));

const findMany = vi.fn();
const deleteMany = vi.fn();
const upsert = vi.fn();
vi.mock('../../config/prisma.js', () => ({
  prisma: { pushSubscription: { findMany, deleteMany, upsert } },
}));

const { notifyEvent, subscribe } = await import('./push.service.js');

const abonnement = (id: string) => ({
  id, endpoint: `https://push.test/${id}`, p256dh: 'cle', auth: 'auth',
});

beforeEach(() => {
  [sendNotification, setVapidDetails, findMany, deleteMany, upsert].forEach((m) => m.mockReset());
});

describe('notifyEvent', () => {
  it("configure les cles VAPID une seule fois, a la premiere utilisation", async () => {
    findMany.mockResolvedValue([]);

    await notifyEvent('e1', { title: 't', body: 'b', url: '/' });
    await notifyEvent('e1', { title: 't', body: 'b', url: '/' });

    // La configuration est paresseuse : le push est facultatif, l'API doit
    // pouvoir demarrer sans cles. Une fois faite, elle n'est pas refaite.
    expect(setVapidDetails).toHaveBeenCalledTimes(1);
  });

  it("continue d'envoyer aux autres quand un abonnement echoue", async () => {
    findMany.mockResolvedValue([abonnement('s1'), abonnement('s2'), abonnement('s3')]);
    sendNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce(undefined);

    const envoyees = await notifyEvent('e1', { title: 'Bal', body: 'Ca commence', url: '/e/x' });

    // Un abonnement expire ne prive pas les deux cents autres.
    expect(envoyees).toBe(2);
  });

  it('supprime les abonnements devenus invalides', async () => {
    findMany.mockResolvedValue([abonnement('s1')]);
    sendNotification.mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }));

    await notifyEvent('e1', { title: 't', body: 'b', url: '/' });

    // Sans ce nettoyage, la table grossirait indefiniment.
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1'] } } });
  });

  it("conserve un abonnement dont l'echec n'est pas definitif", async () => {
    findMany.mockResolvedValue([abonnement('s1')]);
    sendNotification.mockRejectedValue(Object.assign(new Error('timeout'), { statusCode: 500 }));

    await notifyEvent('e1', { title: 't', body: 'b', url: '/' });

    // Une panne passagere du service de notification n'est pas une raison
    // de desabonner l'invite.
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe('subscribe', () => {
  it("rattache l'abonnement a la pellicule, en le remplacant s'il existe", async () => {
    upsert.mockResolvedValue({ id: 'sub1' });

    await subscribe('r1', {
      endpoint: 'https://push.test/abc',
      keys: { p256dh: 'cle', auth: 'auth' },
    });

    // L'adresse identifie l'abonnement : le meme appareil qui se reabonne
    // ne doit pas creer une seconde ligne.
    expect(upsert.mock.calls[0]![0].where).toEqual({ endpoint: 'https://push.test/abc' });
  });
});

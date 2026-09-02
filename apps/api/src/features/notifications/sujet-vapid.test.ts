// apps/api/src/features/notifications/sujet-vapid.test.ts

import { describe, expect, it, vi } from 'vitest';

const env = { CLIENT_URL: 'https://memora-app.fr', VAPID_SUBJECT: undefined as string | undefined };
vi.mock('../../config/env.js', () => ({ env }));
vi.mock('web-push', () => ({ default: { sendNotification: vi.fn(), setVapidDetails: vi.fn() } }));
vi.mock('../../config/prisma.js', () => ({ prisma: {} }));

const { sujetVapid } = await import('./push.service.js');

describe('sujetVapid', () => {
  it("vaut l'adresse du site quand rien n'est regle", () => {
    env.VAPID_SUBJECT = undefined;
    expect(sujetVapid()).toBe('https://memora-app.fr');
    env.VAPID_SUBJECT = '   ';
    expect(sujetVapid()).toBe('https://memora-app.fr');
  });

  it('prefixe une adresse de messagerie nue', () => {
    env.VAPID_SUBJECT = 'contact@memora-app.fr';
    expect(sujetVapid()).toBe('mailto:contact@memora-app.fr');
  });

  it('prend telle quelle une valeur deja conforme', () => {
    env.VAPID_SUBJECT = 'mailto:bonjour@memora-app.fr';
    expect(sujetVapid()).toBe('mailto:bonjour@memora-app.fr');
    env.VAPID_SUBJECT = 'https://memora-app.fr/contact';
    expect(sujetVapid()).toBe('https://memora-app.fr/contact');
  });

  it("ne renvoie plus jamais le domaine qui n'est pas le notre", () => {
    env.VAPID_SUBJECT = undefined;
    expect(sujetVapid()).not.toContain('memora.app');
  });
});

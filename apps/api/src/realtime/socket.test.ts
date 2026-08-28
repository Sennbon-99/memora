// apps/api/src/realtime/socket.test.ts
// Tests du controle d'acces aux salles temps reel.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const eventFindFirst = vi.fn();
const rollFindFirst = vi.fn();

vi.mock('../config/prisma.js', () => ({
  prisma: { event: { findFirst: eventFindFirst }, roll: { findFirst: rollFindFirst } },
}));

const { setupRealtime, eventRoom } = await import('./socket.js');
const { signAccessToken, signDeviceToken } = await import('../utils/jwt.js');

/**
 * Double minimal de Socket.io : on capte le gestionnaire de connexion.
 * cookie simule l'en-tete que le navigateur joint a la poignee de main —
 * c'est de la que vient le jeton d'appareil de l'invite.
 */
function fakeIo(cookie?: string) {
  let onConnection: ((socket: unknown) => void) | undefined;
  const io = { on: (event: string, cb: (s: unknown) => void) => { if (event === 'connection') onConnection = cb; } };
  setupRealtime(io as never);

  const handlers = new Map<string, (payload: unknown) => Promise<void> | void>();
  const emitted: { event: string; payload: unknown }[] = [];
  const joined: string[] = [];
  const socket = {
    on: (event: string, cb: (p: unknown) => Promise<void> | void) => handlers.set(event, cb),
    emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
    join: async (room: string) => { joined.push(room); },
    leave: async () => {},
    handshake: { headers: cookie ? { cookie } : {} },
  };
  onConnection!(socket);
  return { handlers, emitted, joined };
}

beforeEach(() => {
  eventFindFirst.mockReset();
  rollFindFirst.mockReset();
});

describe('event:join', () => {
  it("laisse entrer l'hote de l'evenement", async () => {
    eventFindFirst.mockResolvedValue({ id: 'e1' });
    const { handlers, joined } = fakeIo();

    await handlers.get('event:join')!({
      eventId: 'e1',
      accessToken: signAccessToken({ userId: 'u1', role: 'HOST' }),
    });

    expect(joined).toEqual([eventRoom('e1')]);
  });

  it("laisse entrer un invite dont le cookie d'appareil vise l'evenement", async () => {
    rollFindFirst.mockResolvedValue({ id: 'r1' });
    // C'est le seul chemin dont dispose un invite : son jeton est httpOnly,
    // la page ne peut pas le lire pour le mettre dans la charge utile.
    const { handlers, joined } = fakeIo(`memora_device=${signDeviceToken('r1')}`);

    await handlers.get('event:join')!({ eventId: 'e1' });

    expect(joined).toEqual([eventRoom('e1')]);
  });

  it("lit le cookie d'appareil au milieu des autres cookies", async () => {
    rollFindFirst.mockResolvedValue({ id: 'r1' });
    const { handlers, joined } = fakeIo(
      `_ga=GA1.2.3; memora_device=${signDeviceToken('r1')}; theme=dark`,
    );

    await handlers.get('event:join')!({ eventId: 'e1' });

    expect(joined).toEqual([eventRoom('e1')]);
  });

  it("refuse un invite dont la pellicule est sur un autre evenement", async () => {
    rollFindFirst.mockResolvedValue(null);
    const { handlers, joined, emitted } = fakeIo(`memora_device=${signDeviceToken('r1')}`);

    await handlers.get('event:join')!({ eventId: 'e1' });

    // Sans ce controle, connaitre un identifiant suffirait a recevoir le
    // tableau de bord et les notifications de moments.
    expect(joined).toEqual([]);
    expect(emitted[0]!.event).toBe('event:join:error');
  });

  it('refuse une demande sans aucune preuve', async () => {
    const { handlers, joined } = fakeIo();
    await handlers.get('event:join')!({ eventId: 'e1' });
    expect(joined).toEqual([]);
  });

  it('refuse une demande sans identifiant d evenement', async () => {
    const { handlers, emitted } = fakeIo();
    await handlers.get('event:join')!({});
    expect(emitted[0]!.payload).toMatchObject({ reason: 'MISSING_EVENT' });
  });

  it("refuse un hote qui n'est ni proprietaire ni co-hote", async () => {
    eventFindFirst.mockResolvedValue(null);
    const { handlers, joined } = fakeIo();

    await handlers.get('event:join')!({
      eventId: 'e1', accessToken: signAccessToken({ userId: 'intrus', role: 'HOST' }),
    });

    expect(joined).toEqual([]);
  });
});

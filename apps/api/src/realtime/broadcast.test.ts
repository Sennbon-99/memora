// apps/api/src/realtime/broadcast.test.ts
// Ces trois cas correspondent a un defaut reel, trouve en lancant l'API
// contre la vraie infrastructure : la confirmation d'une photographie
// repondait 500 alors que le fichier etait deja depose et enregistre.

import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { emitToEvent } from './broadcast.js';

/** Requete minimale : seul req.app.get('io') est consulte. */
function fakeRequest(io: unknown): Request {
  return { app: { get: (key: string) => (key === 'io' ? io : undefined) } } as unknown as Request;
}

describe('emitToEvent', () => {
  it('emet vers la salle de l evenement', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));

    expect(emitToEvent(fakeRequest({ to }), 'evt1', 'photo:uploaded', { photoId: 'p1' })).toBe(true);
    expect(to).toHaveBeenCalledWith('event:evt1');
    expect(emit).toHaveBeenCalledWith('photo:uploaded', { photoId: 'p1' });
  });

  it('ne jette pas quand le serveur temps reel est absent', () => {
    // C'est exactement l'etat qui faisait echouer la requete : io n'etait
    // jamais pose sur l'application, et le controleur lisait undefined.
    expect(() => emitToEvent(fakeRequest(undefined), 'evt1', 'photo:uploaded', {})).not.toThrow();
    expect(emitToEvent(fakeRequest(undefined), 'evt1', 'photo:uploaded', {})).toBe(false);
  });

  it('ne jette pas quand la diffusion elle-meme echoue', () => {
    // Une ecriture reussie ne doit jamais devenir une erreur parce qu une
    // notification a echoue : l invite croirait sa pose perdue.
    const io = { to: () => { throw new Error('transport ferme'); } };
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(emitToEvent(fakeRequest(io), 'evt1', 'album:published', {})).toBe(false);
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });
});

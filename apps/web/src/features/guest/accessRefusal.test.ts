import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api.js';
import { accessRefusal } from './GuestJourney.js';

describe('accessRefusal', () => {
  it('ne presente pas une soiree fermee comme introuvable', () => {
    const { title, subtitle } = accessRefusal(
      new ApiError('EVENT_CLOSED', 409, 'La prise de vue est terminée pour cet événement', 'trace'),
    );
    expect(title).toBe('Soirée terminée');
    expect(title).not.toMatch(/introuvable/i);
    expect(subtitle).toMatch(/album/i);
  });

  it('distingue une soiree complete d une soiree fermee', () => {
    const { title } = accessRefusal(new ApiError('EVENT_FULL', 409, 'Complet', 'trace'));
    expect(title).toBe('Soirée complète');
  });

  it('retombe sur introuvable pour un lien reellement invalide', () => {
    const { title } = accessRefusal(new ApiError('NOT_FOUND', 404, 'Introuvable', 'trace'));
    expect(title).toBe('Événement introuvable');
  });

  it('retombe sur introuvable pour une erreur qui ne vient pas de l API', () => {
    const { title } = accessRefusal(new Error('reseau coupe'));
    expect(title).toBe('Événement introuvable');
  });
});

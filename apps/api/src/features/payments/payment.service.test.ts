// apps/api/src/features/payments/payment.service.test.ts
// Tests du paiement. Stripe est remplace par un double : ces tests portent
// sur nos regles, pas sur le prestataire.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const constructEvent = vi.fn();
const sessionsCreate = vi.fn();
const sessionsRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: class {
    webhooks = { constructEvent };
    checkout = { sessions: { create: sessionsCreate, retrieve: sessionsRetrieve } };
  },
}));

const paymentFindUnique = vi.fn();
const paymentUpsert = vi.fn();
const paymentUpdate = vi.fn();
const eventFindUnique = vi.fn();
const transaction = vi.fn();

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    payment: { findUnique: paymentFindUnique, upsert: paymentUpsert, update: paymentUpdate },
    event: { findUnique: eventFindUnique },
    $transaction: transaction,
  },
}));

const { createCheckoutSession, handleWebhook, syncPayment, EVENT_PRICE_CENTS } =
  await import('./payment.service.js');

const draftEvent = { id: 'e1', name: 'Mariage', ownerId: 'u1', state: 'DRAFT', coHosts: [] as unknown[] };

beforeEach(() => {
  [constructEvent, sessionsCreate, sessionsRetrieve, paymentFindUnique,
   paymentUpsert, paymentUpdate, eventFindUnique, transaction].forEach((m) => m.mockReset());
  eventFindUnique.mockResolvedValue(draftEvent);
  transaction.mockResolvedValue([]);
});

describe('createCheckoutSession', () => {
  it('cree une session a 29 euros et enregistre son identifiant', async () => {
    paymentFindUnique.mockResolvedValue(null);
    sessionsCreate.mockResolvedValue({ id: 'cs_123', url: 'https://stripe.test/pay' });

    const result = await createCheckoutSession('e1', 'u1');

    expect(EVENT_PRICE_CENTS).toBe(2900);
    expect(result.checkoutUrl).toContain('stripe.test');
    // L'identifiant de session sert de cle d'idempotence cote base.
    expect(paymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'e1' } }),
    );
  });

  it('refuse si l evenement est deja regle', async () => {
    paymentFindUnique.mockResolvedValue({ state: 'PAID' });
    await expect(createCheckoutSession('e1', 'u1')).rejects.toMatchObject({ code: 'ALREADY_PAID' });
  });

  it("interdit a un co-hote de regler l'evenement", async () => {
    eventFindUnique.mockResolvedValue({ ...draftEvent, ownerId: 'autre', coHosts: [{ userId: 'u1' }] });
    await expect(createCheckoutSession('e1', 'u1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('handleWebhook', () => {
  const body = Buffer.from('{}');

  it('refuse une notification dont la signature est invalide', async () => {
    constructEvent.mockImplementation(() => { throw new Error('signature'); });

    await expect(handleWebhook(body, 'sig-bidon')).rejects.toMatchObject({
      code: 'INVALID_SIGNATURE',
    });
    // Rien n'est ecrit : une requete non signee ne vient pas du prestataire.
    expect(transaction).not.toHaveBeenCalled();
  });

  it('marque le paiement comme regle', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_123', metadata: { eventId: 'e1' } } },
    });
    paymentFindUnique.mockResolvedValue({ eventId: 'e1', state: 'PENDING' });

    const result = await handleWebhook(body, 'sig-valide');

    expect(result).toMatchObject({ handled: true, alreadyProcessed: false, eventId: 'e1' });
    expect(transaction).toHaveBeenCalled();
  });

  it('ignore une notification rejouee', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_123', metadata: { eventId: 'e1' } } },
    });
    paymentFindUnique.mockResolvedValue({ eventId: 'e1', state: 'PAID' });

    const result = await handleWebhook(body, 'sig-valide');

    // Le point du test : un second envoi ne debite ni ne credite deux fois.
    expect(result).toMatchObject({ alreadyProcessed: true });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('acquitte sans traiter les notifications d un autre type', async () => {
    constructEvent.mockReturnValue({ type: 'payment_intent.created', data: { object: {} } });

    const result = await handleWebhook(body, 'sig-valide');
    expect(result).toMatchObject({ handled: false });
  });
});

describe('syncPayment', () => {
  it('renvoie l etat sans interroger le prestataire si le paiement est deja regle', async () => {
    paymentFindUnique.mockResolvedValue({ state: 'PAID', externalRef: 'cs_1' });

    const result = await syncPayment('e1', 'u1');

    expect(result.state).toBe('PAID');
    // Inutile d'appeler Stripe pour confirmer ce qu'on sait deja.
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('rattrape un paiement dont la notification n est jamais arrivee', async () => {
    paymentFindUnique.mockResolvedValue({ state: 'PENDING', externalRef: 'cs_1' });
    sessionsRetrieve.mockResolvedValue({ payment_status: 'paid' });

    const result = await syncPayment('e1', 'u1');

    expect(result.state).toBe('PAID');
    expect(paymentUpdate).toHaveBeenCalled();
  });

  it('laisse le paiement en attente si le prestataire ne l a pas encaisse', async () => {
    paymentFindUnique.mockResolvedValue({ state: 'PENDING', externalRef: 'cs_1' });
    sessionsRetrieve.mockResolvedValue({ payment_status: 'unpaid' });

    const result = await syncPayment('e1', 'u1');

    expect(result.state).toBe('PENDING');
    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it("interdit a un co-hote de consulter l'etat du paiement", async () => {
    eventFindUnique.mockResolvedValue({ ...draftEvent, ownerId: 'autre', coHosts: [{ userId: 'u1' }] });
    await expect(syncPayment('e1', 'u1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('renvoie une erreur si aucun paiement n a ete engage', async () => {
    paymentFindUnique.mockResolvedValue(null);
    await expect(syncPayment('e1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

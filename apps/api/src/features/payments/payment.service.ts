// apps/api/src/features/payments/payment.service.ts
// Reglement d'un evenement au-dela de l'offre gratuite.
//
// Regle absolue du module : aucune donnee bancaire ne transite par cette
// application, ni ne s'y trouve stockee. La saisie a lieu sur une page
// hebergee par le prestataire, ce qui reduit d'autant la surface de
// responsabilite du projet.

import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { assertCanManage } from '../events/event.service.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/** Prix unique par evenement, invites illimites dans la limite technique de 200. */
export const EVENT_PRICE_CENTS = 2900;

/**
 * Cree une session de paiement et renvoie l'adresse ou rediriger l'hote.
 * L'evenement n'est pas ouvert pour autant : il le sera a la reception de
 * la notification signee du prestataire, jamais sur la seule foi du retour
 * de navigateur, qui est manipulable.
 */
export async function createCheckoutSession(eventId: string, userId: string) {
  const { event, isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError("Seul l'hote peut regler l'evenement");
  if (event.state !== 'DRAFT') {
    throw new AppError('ALREADY_OPEN', 409, 'Cet evenement est deja ouvert');
  }

  const existing = await prisma.payment.findUnique({ where: { eventId } });
  if (existing?.state === 'PAID') {
    throw new AppError('ALREADY_PAID', 409, 'Cet evenement est deja regle');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: EVENT_PRICE_CENTS,
        product_data: {
          name: `Memora — ${event.name}`,
          description: 'Evenement, invites illimites, photographies conservees trente jours',
        },
      },
    }],
    success_url: `${env.CLIENT_URL}/evenements/${eventId}?paiement=succes`,
    cancel_url: `${env.CLIENT_URL}/evenements/${eventId}?paiement=annule`,
    // On retrouvera l'evenement a la reception de la notification.
    metadata: { eventId },
  });

  // On enregistre la session en attente. L'identifiant sert aussi de cle
  // d'idempotence : sa contrainte d'unicite empeche tout double traitement.
  await prisma.payment.upsert({
    where: { eventId },
    create: { eventId, amountCents: EVENT_PRICE_CENTS, externalRef: session.id, state: 'PENDING' },
    update: { externalRef: session.id, state: 'PENDING' },
  });

  return { checkoutUrl: session.url, sessionId: session.id };
}

/**
 * Traite une notification du prestataire.
 *
 * Deux garanties. La signature est verifiee sur le corps BRUT de la requete :
 * si un middleware l'avait deja transforme en objet, la verification
 * echouerait. Et le traitement est idempotent : une notification renvoyee
 * deux fois, ce qui arrive normalement en cas de reessai du prestataire,
 * ne credite l'evenement qu'une seule fois.
 */
export async function handleWebhook(rawBody: Buffer, signature: string) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    // Signature invalide : la requete ne vient pas du prestataire.
    throw new AppError('INVALID_SIGNATURE', 400, 'Signature invalide');
  }

  if (event.type !== 'checkout.session.completed') {
    // Les autres notifications sont acquittees sans traitement.
    return { handled: false, type: event.type };
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const eventId = session.metadata?.eventId;
  if (!eventId) throw new NotFoundError('Evenement');

  const payment = await prisma.payment.findUnique({ where: { eventId } });
  if (!payment) throw new NotFoundError('Paiement');

  // Idempotence : si le paiement est deja marque regle, on s'arrete la.
  if (payment.state === 'PAID') return { handled: true, alreadyProcessed: true };

  await prisma.$transaction([
    prisma.payment.update({
      where: { eventId },
      data: { state: 'PAID', paidAt: new Date(), externalRef: session.id },
    }),
    // Le paiement n'ouvre pas l'evenement de lui-meme : il leve seulement
    // le verrou. L'hote garde la main sur le moment de l'ouverture.
  ]);

  return { handled: true, alreadyProcessed: false, eventId };
}

/**
 * Verification differee, pour le cas ou la notification ne serait jamais
 * arrivee. Appelee quand l'hote revient sur la page apres un paiement.
 */
export async function syncPayment(eventId: string, userId: string) {
  const { isOwner } = await assertCanManage(eventId, userId);
  if (!isOwner) throw new ForbiddenError();

  const payment = await prisma.payment.findUnique({ where: { eventId } });
  if (!payment) throw new NotFoundError('Paiement');
  if (payment.state === 'PAID') return { state: payment.state };

  const session = await stripe.checkout.sessions.retrieve(payment.externalRef);
  if (session.payment_status === 'paid') {
    await prisma.payment.update({
      where: { eventId },
      data: { state: 'PAID', paidAt: new Date() },
    });
    return { state: 'PAID' as const };
  }

  return { state: payment.state };
}

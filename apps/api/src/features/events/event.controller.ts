// apps/api/src/features/events/event.controller.ts
// Lien entre HTTP et le service. Aucune regle metier ici.

import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as eventService from './event.service.js';
import { UnauthorizedError } from '../../utils/errors.js';

/** Petit garde-fou : requireAuth garantit req.user, TypeScript ne le sait pas. */
function currentUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.user) throw new UnauthorizedError();
  return req.user.id;
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const event = await eventService.createEvent(currentUserId(req), req.body);
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    res.status(200).json({ events: await eventService.listEvents(currentUserId(req)) });
  } catch (err) {
    next(err);
  }
};

export const detail: RequestHandler = async (req, res, next) => {
  try {
    const event = await eventService.getEvent(req.params.id!, currentUserId(req));
    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const event = await eventService.updateEvent(req.params.id!, currentUserId(req), req.body);
    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
};

export const open: RequestHandler = async (req, res, next) => {
  try {
    const event = await eventService.openEvent(req.params.id!, currentUserId(req));
    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
};

export const close: RequestHandler = async (req, res, next) => {
  try {
    const event = await eventService.closeEvent(req.params.id!, currentUserId(req));
    // On previent les invites connectes que la pellicule est terminee.
    req.io.to(`event:${event.id}`).emit('event:closed', { eventId: event.id });
    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
};

/** Schema local : il ne concerne que cette route, inutile de le partager. */
const tablesSchema = z.object({
  labels: z.array(z.string().trim().min(1).max(40)).min(1).max(60),
});

export const createTables: RequestHandler = async (req, res, next) => {
  try {
    const { labels } = tablesSchema.parse(req.body);
    const tables = await eventService.createTables(req.params.id!, currentUserId(req), labels);
    res.status(201).json({ tables });
  } catch (err) {
    next(err);
  }
};

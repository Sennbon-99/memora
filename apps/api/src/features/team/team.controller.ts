// apps/api/src/features/team/team.controller.ts

import type { RequestHandler } from 'express';
import { z } from 'zod';
import * as teamService from './team.service.js';
import { currentUserId, routeParam } from '../../utils/http.js';
import { DEVICE_COOKIE } from '../../middlewares/requireGuest.js';
import { isProduction } from '../../config/env.js';

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email() });

/** POST /api/events/:id/co-hosts — inviter un co-hote. */
export const invite: RequestHandler = async (req, res, next) => {
  try {
    const { email } = inviteSchema.parse(req.body);
    const result = await teamService.inviteCoHost(routeParam(req, 'id'), currentUserId(req), email);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/** GET /api/events/:id/co-hosts — lister les co-hotes. */
export const list: RequestHandler = async (req, res, next) => {
  try {
    const coHosts = await teamService.listCoHosts(routeParam(req, 'id'), currentUserId(req));
    res.status(200).json({ coHosts });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/events/:id/co-hosts/:userId — retirer un co-hote. */
export const remove: RequestHandler = async (req, res, next) => {
  try {
    const result = await teamService.removeCoHost(
      routeParam(req, 'id'), currentUserId(req), routeParam(req, 'userId'),
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/** POST /api/events/:id/photographer — produire le lien du photographe. */
export const photographerLink: RequestHandler = async (req, res, next) => {
  try {
    const result = await teamService.createPhotographerLink(
      routeParam(req, 'id'), currentUserId(req),
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/** GET /api/p/:token — le photographe ouvre sa pellicule. */
export const joinAsPhotographer: RequestHandler = async (req, res, next) => {
  try {
    const existing = req.cookies?.[DEVICE_COOKIE] as string | undefined;
    const session = await teamService.joinAsPhotographer(routeParam(req, 'token'), existing);

    res.cookie(DEVICE_COOKIE, session.deviceToken, {
      httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });
    const { deviceToken: _omit, ...payload } = session;
    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
};

// apps/api/src/features/dashboard/dashboard.controller.ts

import type { RequestHandler } from 'express';
import * as dashboardService from './dashboard.service.js';
import { currentUserId, routeParam } from '../../utils/http.js';

/** GET /api/events/:id/stats — participation en direct. */
export const stats: RequestHandler = async (req, res, next) => {
  try {
    const data = await dashboardService.getStats(routeParam(req, 'id'), currentUserId(req));
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

import { Router } from 'express';
import { z } from 'zod';
import {
  applyManualEdit,
  archivePlanningWeek,
  assignDriverToWeek,
  createPlanningWeek,
  getPlanningWeek,
  listPlanningWeeks,
  selectOrdersForWeek,
  setOrderStatus,
  transferOrdersFromPreviousWeek,
  unassignDriverFromWeek,
  updateDriverWorkDays,
} from './planning.service.js';

const createWeekSchema = z.object({
  weekStartDate: z.string(),
});

const driverAssignmentSchema = z.object({
  driverId: z.string().min(1),
  workDaysCount: z.number().int().min(1).max(7).default(5),
});

const workDaysSchema = z.object({
  workDaysCount: z.number().int().min(1).max(7),
});

const ordersSchema = z.object({
  orderIds: z.array(z.string().min(1)),
});

const orderStatusSchema = z.object({
  status: z.enum(['unassigned', 'planned', 'conflict', 'moved', 'skipped']),
});

const manualEditSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('MOVE_ORDER'),
    actor: z.string().min(1),
    orderId: z.string().min(1),
    fromDriverId: z.string().min(1),
    fromDay: z.number().int().min(1).max(7),
    toDriverId: z.string().min(1),
    toDay: z.number().int().min(1).max(7),
    toSequence: z.number().int().min(1).optional(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('MOVE_DAY'),
    actor: z.string().min(1),
    orderId: z.string().min(1),
    driverId: z.string().min(1),
    fromDay: z.number().int().min(1).max(7),
    toDay: z.number().int().min(1).max(7),
    toSequence: z.number().int().min(1).optional(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('RESEQUENCE_STOP'),
    actor: z.string().min(1),
    driverId: z.string().min(1),
    day: z.number().int().min(1).max(7),
    stopId: z.string().min(1),
    toSequence: z.number().int().min(1),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('REMOVE_STOP'),
    actor: z.string().min(1),
    driverId: z.string().min(1),
    day: z.number().int().min(1).max(7),
    stopId: z.string().min(1),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('ADD_STOP'),
    actor: z.string().min(1),
    driverId: z.string().min(1),
    day: z.number().int().min(1).max(7),
    orderId: z.string().min(1),
    toSequence: z.number().int().min(1).optional(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('UPDATE_EXTERNAL_LINK'),
    actor: z.string().min(1),
    driverId: z.string().min(1),
    externalRouteLink: z.string().url(),
    reason: z.string().optional(),
  }),
]);

const router = Router();

router.get('/weeks', (_req, res) => {
  res.json(listPlanningWeeks());
});

router.post('/weeks', (req, res, next) => {
  try {
    const payload = createWeekSchema.parse(req.body);
    res.status(201).json(createPlanningWeek(payload.weekStartDate));
  } catch (error) {
    next(error);
  }
});

router.get('/weeks/:weekId', (req, res, next) => {
  try {
    res.json(getPlanningWeek(req.params.weekId));
  } catch (error) {
    next(error);
  }
});

router.post('/weeks/:weekId/drivers', (req, res, next) => {
  try {
    const payload = driverAssignmentSchema.parse(req.body);
    res.json(assignDriverToWeek(req.params.weekId, payload.driverId, payload.workDaysCount));
  } catch (error) {
    next(error);
  }
});

router.delete('/weeks/:weekId/drivers/:driverId', (req, res, next) => {
  try {
    res.json(unassignDriverFromWeek(req.params.weekId, req.params.driverId));
  } catch (error) {
    next(error);
  }
});

router.patch('/weeks/:weekId/drivers/:driverId/work-days', (req, res, next) => {
  try {
    const payload = workDaysSchema.parse(req.body);
    res.json(updateDriverWorkDays(req.params.weekId, req.params.driverId, payload.workDaysCount));
  } catch (error) {
    next(error);
  }
});

router.put('/weeks/:weekId/orders', (req, res, next) => {
  try {
    const payload = ordersSchema.parse(req.body);
    res.json(selectOrdersForWeek(req.params.weekId, payload.orderIds));
  } catch (error) {
    next(error);
  }
});

router.patch('/weeks/:weekId/orders/:orderId/status', (req, res, next) => {
  try {
    const payload = orderStatusSchema.parse(req.body);
    res.json(setOrderStatus(req.params.weekId, req.params.orderId, payload.status));
  } catch (error) {
    next(error);
  }
});

router.post('/weeks/:weekId/orders/transfer', (req, res, next) => {
  try {
    const payload = ordersSchema.parse(req.body);
    res.json(transferOrdersFromPreviousWeek(req.params.weekId, payload.orderIds));
  } catch (error) {
    next(error);
  }
});

router.post('/weeks/:weekId/manual-edit', (req, res, next) => {
  try {
    const payload = manualEditSchema.parse(req.body);
    res.json(applyManualEdit(req.params.weekId, payload));
  } catch (error) {
    next(error);
  }
});

router.post('/weeks/:weekId/archive', (req, res, next) => {
  try {
    res.json(archivePlanningWeek(req.params.weekId));
  } catch (error) {
    next(error);
  }
});

export { router as planningRouter };

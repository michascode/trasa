import { Router } from 'express';
import { z } from 'zod';
import { getDemoScenario, listDemoScenarios, runOptimization } from './optimizer.service.js';

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const optimizationInput = z.object({
  weekStartDate: z.string().min(1),
  depot: z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    location: latLngSchema,
  }),
  drivers: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      workDaysCount: z.number().int().min(1).max(7),
      vehicleCapacityUnits: z.number().int().positive().optional(),
      vehicleFuelConsumptionLPer100Km: z.number().positive().optional(),
      homeBase: latLngSchema.optional(),
    }),
  ),
  orders: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      location: latLngSchema,
      units: z.number().int().positive(),
      serviceDurationMin: z.number().int().positive().optional(),
    }),
  ),
  options: z
    .object({
      vehicleCapacityUnits: z.number().int().positive().optional(),
      targetDailyKm: z.number().positive().optional(),
      targetDailyStopsMin: z.number().int().positive().optional(),
      targetDailyStopsMax: z.number().int().positive().optional(),
      fuelPricePerLiter: z.number().positive().optional(),
      averageSpeedKmh: z.number().positive().optional(),
      forbidTollRoads: z.boolean().optional(),
      allowOvernightStay: z.boolean().optional(),
    })
    .optional(),
});

const router = Router();

router.get('/scenarios', (_req, res) => {
  res.json(listDemoScenarios());
});

router.get('/scenarios/:scenarioId', (req, res) => {
  const scenario = getDemoScenario(req.params.scenarioId);
  if (!scenario) {
    return res.status(404).json({ message: 'Nie znaleziono scenariusza demo.' });
  }
  return res.json(scenario);
});

router.post('/run', async (req, res) => {
  const parsed = optimizationInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const result = await runOptimization(parsed.data);
  const statusCode = result.status === 'INFEASIBLE' ? 422 : 200;
  return res.status(statusCode).json(result);
});

export { router as optimizerRouter };

import { Router } from 'express';
import { z } from 'zod';
import { correctImportedRow, exportBatchToExcel, getBatchPreview, getParserMetadata, importOrdersFromExcel } from './import.service.js';

const router = Router();

const uploadSchema = z.object({
  filename: z.string().min(1),
  fileBase64: z.string().min(1),
  planningWeekId: z.string().optional(),
});

router.post('/orders/upload', async (req, res, next) => {
  try {
    const payload = uploadSchema.parse(req.body);
    const buffer = Buffer.from(payload.fileBase64, 'base64');
    const result = await importOrdersFromExcel(buffer, payload.filename, payload.planningWeekId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/batches/:batchId', async (req, res, next) => {
  try {
    const batch = await getBatchPreview(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch nie istnieje.' });
    }
    return res.json(batch);
  } catch (error) {
    return next(error);
  }
});

const correctionSchema = z.object({
  addressLine: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  orderedGoodsText: z.string().trim().optional(),
  numberingText: z.string().trim().optional(),
  correctionNotes: z.string().trim().optional(),
});

router.patch('/orders/rows/:rowId', async (req, res, next) => {
  try {
    const payload = correctionSchema.parse(req.body);
    const order = await correctImportedRow(req.params.rowId, payload);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/batches/:batchId/export', async (req, res, next) => {
  try {
    const buffer = await exportBatchToExcel(req.params.batchId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="import-batch-${req.params.batchId}.csv"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

router.get('/orders/parser-metadata', async (_req, res, next) => {
  try {
    const metadata = await getParserMetadata();
    return res.json(metadata);
  } catch (error) {
    return next(error);
  }
});

export { router as importRouter };

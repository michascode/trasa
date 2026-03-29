import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { pushAuditEvent } from '../observability/audit-trail.js';
import { parseRawOrderText, SUPPORTED_PATTERNS } from './import.parser.js';
import type { ExcelImportRow, ImportIssue, ParserMetadata } from './import.types.js';

const execFileAsync = promisify(execFile);

const HEADER_MAP: Record<string, string> = {
  kierowca: 'Kierowca', nrprzystanku: 'Nr Przystanku', zamówieniasurowe: 'Zamówienia surowe', zamowieniasurowe: 'Zamówienia surowe',
  status: 'Status', adres: 'Adres', telefon: 'Telefon', rosa: 'Rosa', leghorn: 'Leghorn', sandy: 'Sandy', astra: 'Astra', stara: 'Stara', kogut: 'Kogut',
  uwagi: 'UWAGI', zamowionetowary: 'ZAMOWIONE TOWARY', donumerowania: 'do numerowania',
};
const QUANTITY_COLUMNS = ['Rosa', 'Leghorn', 'Sandy', 'Astra', 'Stara', 'Kogut'];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function valueToNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function decodeXmlText(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function extractSheetRowsFromXlsx(fileBuffer: Buffer): Promise<Array<Record<string, unknown>>> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trasa-import-'));
  const filePath = path.join(tempDir, 'upload.xlsx');
  await fs.writeFile(filePath, fileBuffer);
  try {
    const list = await execFileAsync('unzip', ['-Z1', filePath]);
    const names = list.stdout.split('\n').map((name) => name.trim()).filter(Boolean);
    const sharedStringsName = names.find((name) => name.endsWith('xl/sharedStrings.xml'));
    const worksheetName = names.find((name) => name.endsWith('xl/worksheets/sheet1.xml'));
    if (!worksheetName) {
      throw new Error('Nie znaleziono pierwszego arkusza w pliku XLSX.');
    }

    const sharedStrings = new Map<number, string>();
    if (sharedStringsName) {
      const sharedXml = await execFileAsync('unzip', ['-p', filePath, sharedStringsName]);
      const values = [...sharedXml.stdout.matchAll(/<t[^>]*>(.*?)<\/t>/gms)].map((m) => decodeXmlText(m[1]));
      values.forEach((val, idx) => sharedStrings.set(idx, val));
    }

    const sheetXml = await execFileAsync('unzip', ['-p', filePath, worksheetName]);
    const rowsRaw = [...sheetXml.stdout.matchAll(/<row[^>]*>(.*?)<\/row>/gms)].map((m) => m[1]);
    const matrix: string[][] = rowsRaw.map((rowXml) => {
      const cellRegex = /<c([^>]*)>(?:<v>(.*?)<\/v>|<is><t>(.*?)<\/t><\/is>)?<\/c>/gms;
      const rowValues: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = cellRegex.exec(rowXml))) {
        const attrs = match[1] ?? '';
        const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? 'A';
        const type = /t="(\w+)"/.exec(attrs)?.[1];
        const index = ref.split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
        while (rowValues.length < index) rowValues.push('');
        const rawValue = match[2] ?? match[3] ?? '';
        const value = type === 's' ? sharedStrings.get(Number(rawValue)) ?? '' : decodeXmlText(rawValue);
        rowValues[index] = value;
      }
      return rowValues;
    });

    const [headers, ...rows] = matrix;
    const mappedHeaders = (headers ?? []).map((h) => HEADER_MAP[normalizeHeader(h)] ?? String(h ?? '').trim());
    return rows.map((rowValues) => mappedHeaders.reduce<Record<string, unknown>>((acc, header, idx) => {
      acc[header] = rowValues[idx] ?? '';
      return acc;
    }, {}));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function buildAliasMap() { const aliases = await prisma.breedAliasDictionary.findMany({ where: { isActive: true } }); const aliasMap = new Map<string, string>(); aliases.forEach((a) => aliasMap.set(a.alias.toLowerCase(), a.canonicalBreedKey)); return { aliases, aliasMap }; }
async function resolvePlanningWeekId(planningWeekId?: string) { if (planningWeekId) return planningWeekId; const p = await prisma.planningWeek.findFirst({ where: { isCurrentVersion: true }, orderBy: { weekStartDate: 'desc' } }); if (!p) throw new Error('Brak tygodnia planowania do podpięcia importu.'); return p.id; }
function canonicalFingerprint(row: ExcelImportRow): string { const items = row.parsed.items.map((i) => `${i.canonicalBreedKey}:${i.units}`).sort().join('|'); return [row.parsed.postalCode ?? '', row.parsed.addressLine ?? '', row.parsed.phone ?? '', items].join('#').toLowerCase(); }
function detectRowIssues(row: ExcelImportRow, seen: Set<string>): ImportIssue[] { const issues: ImportIssue[] = [...row.issues]; if (!row.parsed.addressLine) issues.push({ code: 'MISSING_ADDRESS', severity: 'error', message: 'Brak adresu w zamówieniu.' }); if (!row.parsed.phone) issues.push({ code: 'MISSING_PHONE', severity: 'error', message: 'Brak telefonu w zamówieniu.' }); row.parsed.unknownAliases.forEach((alias) => issues.push({ code: 'UNKNOWN_BREED', severity: 'error', message: `Nierozpoznana rasa/towar: ${alias}.`, details: { alias } })); if (seen.has(row.duplicateFingerprint)) issues.push({ code: 'DUPLICATE_ORDER', severity: 'warning', message: 'Duplikat zamówienia w obrębie batcha.' }); seen.add(row.duplicateFingerprint); if (row.parsed.addressLine) issues.push({ code: 'MISSING_GEOCODING', severity: 'warning', message: 'Brak geokodowania adresu (geocoder nie zwrócił punktu).' }); return issues; }

export async function importOrdersFromExcel(fileBuffer: Buffer, sourceFilename: string, planningWeekId?: string) {
  const boundPlanningWeekId = await resolvePlanningWeekId(planningWeekId);
  const sourceHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const existing = await prisma.orderImportBatch.findFirst({ where: { planningWeekId: boundPlanningWeekId, sourceHash }, include: { rawRows: { include: { normalizedOrder: { include: { orderItems: true } } }, orderBy: { rowNumber: 'asc' } } } });
  if (existing) return { reused: true, batch: existing };

  const jsonRows = await extractSheetRowsFromXlsx(fileBuffer);
  const { aliases, aliasMap } = await buildAliasMap();
  const parsedRows: ExcelImportRow[] = [];
  const duplicateGuard = new Set<string>();

  jsonRows.forEach((rawCells, index) => {
    const rowNumber = index + 2;
    const rawOrderText = String(rawCells['Zamówienia surowe'] ?? '').trim();
    if (!rawOrderText) return;
    const parsed = parseRawOrderText(rawOrderText, aliasMap, { notes: String(rawCells['UWAGI'] ?? '').trim(), orderedGoodsText: String(rawCells['ZAMOWIONE TOWARY'] ?? '').trim(), numberingText: String(rawCells['do numerowania'] ?? '').trim(), address: String(rawCells['Adres'] ?? '').trim(), phone: String(rawCells['Telefon'] ?? '').trim() });
    const row: ExcelImportRow = { rowNumber, rawCells, rawOrderText, parsed, issues: [], duplicateFingerprint: '' };

    for (const column of QUANTITY_COLUMNS) {
      const declared = valueToNumber(rawCells[column]);
      if (declared === null) continue;
      const canonical = aliasMap.get(column.toLowerCase()) ?? column.toLowerCase();
      const parsedUnits = row.parsed.items.find((item) => item.canonicalBreedKey === canonical)?.units ?? 0;
      if (parsedUnits !== 0 && parsedUnits !== declared) row.issues.push({ code: 'QUANTITY_CONFLICT', severity: 'warning', message: `Konflikt ilości dla ${column}: parser=${parsedUnits}, kolumna=${declared}.`, details: { column, parserUnits: parsedUnits, declaredUnits: declared } });
      if (parsedUnits === 0 && declared > 0) row.parsed.items.push({ canonicalBreedKey: canonical, sourceAlias: column.toLowerCase(), units: declared, sourceText: `${declared} ${column}` });
    }

    row.duplicateFingerprint = canonicalFingerprint(row);
    row.issues = detectRowIssues(row, duplicateGuard);
    parsedRows.push(row);
  });

  if (parsedRows.length === 0) {
    throw new Error('Import nie zawiera żadnych zamówień do przetworzenia.');
  }

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.orderImportBatch.create({ data: { planningWeekId: boundPlanningWeekId, sourceFilename, sourceHash, totalRows: parsedRows.length, status: 'PARSED' } });
    let successRows = 0; let errorRows = 0;
    for (const row of parsedRows) {
      const hasError = row.issues.some((issue) => issue.severity === 'error');
      const status = hasError ? 'ERROR' : row.issues.length ? 'WARNING' : 'OK';
      if (hasError) errorRows += 1; else successRows += 1;
      const order = await tx.order.create({ data: { currentPlanningWeekId: boundPlanningWeekId, rawOrderText: row.rawOrderText, postalCode: row.parsed.postalCode, addressLine: row.parsed.addressLine, phone: row.parsed.phone, notes: row.parsed.notes, orderedGoodsText: row.parsed.orderedGoodsText, numberingText: row.parsed.numberingText, orderItems: { create: row.parsed.items.map((item) => ({ canonicalBreedKey: item.canonicalBreedKey, sourceLabel: item.sourceAlias, units: item.units, breedAliasId: aliases.find((a) => a.alias.toLowerCase() === item.sourceAlias)?.id })) }, weekAssignments: { create: { planningWeekId: boundPlanningWeekId, isCurrent: true, transferReason: 'Excel import' } } } });
      await tx.rawImportedOrderRow.create({ data: { importBatchId: created.id, rowNumber: row.rowNumber, rawCellsJson: row.rawCells as Prisma.InputJsonValue, rawOrderText: row.rawOrderText, parseStatus: status, parseErrorsJson: row.issues as unknown as Prisma.InputJsonValue, normalizedOrderId: order.id } });
    }
    return tx.orderImportBatch.update({ where: { id: created.id }, data: { successRows, errorRows, status: errorRows > 0 ? 'FAILED' : 'VALIDATED' }, include: { rawRows: { include: { normalizedOrder: { include: { orderItems: true } } }, orderBy: { rowNumber: 'asc' } } } });
  });
  pushAuditEvent({
    action: 'IMPORT_UPLOAD',
    status: batch.errorRows > 0 ? 'failure' : 'success',
    resource: `import-batch:${batch.id}`,
    details: {
      sourceFilename,
      totalRows: batch.totalRows,
      successRows: batch.successRows,
      errorRows: batch.errorRows,
    },
  });
  return { reused: false, batch };
}

export async function getBatchPreview(batchId: string) { return prisma.orderImportBatch.findUnique({ where: { id: batchId }, include: { rawRows: { include: { normalizedOrder: { include: { orderItems: true } } }, orderBy: { rowNumber: 'asc' } } } }); }
export async function correctImportedRow(
  rowId: string,
  payload: { addressLine?: string; phone?: string; notes?: string; orderedGoodsText?: string; numberingText?: string; correctionNotes?: string },
) {
  const row = await prisma.rawImportedOrderRow.findUniqueOrThrow({ where: { id: rowId } });
  if (!row.normalizedOrderId) throw new Error('Wiersz nie jest powiązany z zamówieniem.');

  const order = await prisma.order.update({
    where: { id: row.normalizedOrderId },
    data: {
      addressLine: payload.addressLine,
      phone: payload.phone,
      notes: payload.notes,
      orderedGoodsText: payload.orderedGoodsText,
      numberingText: payload.numberingText,
    },
  });

  await prisma.rawImportedOrderRow.update({
    where: { id: rowId },
    data: {
      parseStatus: 'CORRECTED',
      correctionNotes: payload.correctionNotes,
      parseErrorsJson: [] as unknown as Prisma.InputJsonValue,
    },
  });

  pushAuditEvent({
    action: 'IMPORT_CORRECTION',
    status: 'success',
    resource: `import-row:${rowId}`,
    details: { correctionNotes: payload.correctionNotes ?? null },
  });
  return order;
}

function escapeCsv(value: string) { if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`; return value; }

export async function exportBatchToExcel(batchId: string) {
  const batch = await prisma.orderImportBatch.findUniqueOrThrow({ where: { id: batchId }, include: { rawRows: { include: { normalizedOrder: { include: { orderItems: true } } }, orderBy: { rowNumber: 'asc' } } } });
  const headers = ['Kierowca', 'Nr Przystanku', 'Zamówienia surowe', 'Status', 'Adres', 'Telefon', 'Rosa', 'Leghorn', 'Sandy', 'Astra', 'Stara', 'Kogut', 'UWAGI', 'ZAMOWIONE TOWARY', 'do numerowania'];
  const lines = [headers.join(';')];
  for (const row of batch.rawRows) {
    const order = row.normalizedOrder;
    const itemsByKey = new Map((order?.orderItems ?? []).map((item) => [item.canonicalBreedKey.toLowerCase(), String(item.units)]));
    const values = ['', '', row.rawOrderText, row.parseStatus, order?.addressLine ?? '', order?.phone ?? '', itemsByKey.get('rosa') ?? '', itemsByKey.get('leghorn') ?? '', itemsByKey.get('sandy') ?? '', itemsByKey.get('astra') ?? '', itemsByKey.get('stara') ?? '', itemsByKey.get('kogut') ?? '', order?.notes ?? '', order?.orderedGoodsText ?? '', order?.numberingText ?? ''];
    lines.push(values.map((v) => escapeCsv(String(v))).join(';'));
  }
  return Buffer.from(lines.join('\n'), 'utf-8');
}

export async function getParserMetadata(): Promise<ParserMetadata> { const aliases = await prisma.breedAliasDictionary.findMany({ where: { isActive: true }, orderBy: { alias: 'asc' } }); return { supportedPatterns: SUPPORTED_PATTERNS, aliases: aliases.map((a) => ({ alias: a.alias, canonicalBreedKey: a.canonicalBreedKey })) }; }

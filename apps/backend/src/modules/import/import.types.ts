export type ParsedItem = {
  canonicalBreedKey: string;
  sourceAlias: string;
  units: number;
  sourceText: string;
};

export type ImportIssueCode =
  | 'MISSING_ADDRESS'
  | 'MISSING_PHONE'
  | 'UNKNOWN_BREED'
  | 'QUANTITY_CONFLICT'
  | 'DUPLICATE_ORDER'
  | 'MISSING_GEOCODING';

export type ImportIssueSeverity = 'warning' | 'error';

export type ImportIssue = {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  message: string;
  details?: Record<string, unknown>;
};

export type ParsedOrder = {
  postalCode: string | null;
  addressLine: string | null;
  phone: string | null;
  notes: string | null;
  orderedGoodsText: string | null;
  numberingText: string | null;
  items: ParsedItem[];
  unknownAliases: string[];
};

export type ExcelImportRow = {
  rowNumber: number;
  rawOrderText: string;
  rawCells: Record<string, unknown>;
  parsed: ParsedOrder;
  issues: ImportIssue[];
  duplicateFingerprint: string;
};

export type ParserMetadata = {
  supportedPatterns: string[];
  aliases: Array<{ alias: string; canonicalBreedKey: string }>;
};

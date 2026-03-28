import type { ParsedItem, ParsedOrder } from './import.types.js';

const POSTAL_CODE_REGEX = /\b\d{2}-\d{3}\b/;
const PHONE_REGEX = /(?:\+48\s*)?(\d{3})[\s-]?(\d{3})[\s-]?(\d{3})\b/;
const ITEM_SLASH_REGEX = /(\d+)\s*\/\s*(\d+)\s*([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)/g;
const ITEM_SIMPLE_REGEX = /(\d+)\s+([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)/g;

const normalizeAlias = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[!.,;:]/g, '');

export function parseRawOrderText(
  rawOrderText: string,
  aliasMap: Map<string, string>,
  fallbackFields?: { notes?: string | null; orderedGoodsText?: string | null; numberingText?: string | null; address?: string | null; phone?: string | null }
): ParsedOrder {
  const text = rawOrderText.trim();
  const [mainText, ...noteParts] = text.split(/\s-\s/);
  const derivedNotes = noteParts.length ? noteParts.join(' - ').trim() : null;

  const postalCode = mainText.match(POSTAL_CODE_REGEX)?.[0] ?? null;
  const phoneMatch = mainText.match(PHONE_REGEX);
  const phone = fallbackFields?.phone ?? (phoneMatch ? `${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}` : null);

  const beforePhone = phoneMatch ? mainText.slice(0, phoneMatch.index).trim() : mainText;
  const addressCandidate = postalCode
    ? beforePhone.replace(postalCode, '').trim()
    : beforePhone;

  const parsedItems: ParsedItem[] = [];
  const unknownAliases = new Set<string>();

  for (const match of mainText.matchAll(ITEM_SLASH_REGEX)) {
    const units = Number(match[1]);
    const rawAlias = normalizeAlias(match[3]);
    const canonical = aliasMap.get(rawAlias);
    if (!canonical) {
      unknownAliases.add(rawAlias);
      continue;
    }
    parsedItems.push({
      canonicalBreedKey: canonical,
      sourceAlias: rawAlias,
      units,
      sourceText: match[0],
    });
  }

  const covered = new Set(parsedItems.map((item) => item.sourceText));
  for (const match of mainText.matchAll(ITEM_SIMPLE_REGEX)) {
    if (covered.has(match[0])) {
      continue;
    }
    const units = Number(match[1]);
    const rawAlias = normalizeAlias(match[2]);
    const canonical = aliasMap.get(rawAlias);
    if (!canonical) {
      unknownAliases.add(rawAlias);
      continue;
    }
    parsedItems.push({
      canonicalBreedKey: canonical,
      sourceAlias: rawAlias,
      units,
      sourceText: match[0],
    });
  }

  const grouped = new Map<string, ParsedItem>();
  for (const item of parsedItems) {
    const existing = grouped.get(item.canonicalBreedKey);
    if (existing) {
      existing.units += item.units;
      existing.sourceText = `${existing.sourceText} + ${item.sourceText}`;
    } else {
      grouped.set(item.canonicalBreedKey, { ...item });
    }
  }

  return {
    postalCode,
    addressLine: fallbackFields?.address?.trim() || addressCandidate || null,
    phone,
    notes: fallbackFields?.notes?.trim() || derivedNotes,
    orderedGoodsText: fallbackFields?.orderedGoodsText?.trim() || parsedItems.map((item) => item.sourceText).join(', ') || null,
    numberingText: fallbackFields?.numberingText?.trim() || mainText,
    items: Array.from(grouped.values()),
    unknownAliases: Array.from(unknownAliases.values()),
  };
}

export const SUPPORTED_PATTERNS = [
  'kod pocztowy: \\b\\d{2}-\\d{3}\\b',
  'telefon PL: (?:+48)? 9 cyfr',
  'ilość/rozmiar alias: (\\d+)/(\\d+) alias',
  'ilość alias: (\\d+) alias',
  'uwagi po separatorze " - "',
];

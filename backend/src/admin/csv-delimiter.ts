import { parse } from 'csv-parse/sync';

export const REQUIRED_CSV_HEADERS = ['firstName', 'lastName', 'email'] as const;
const DELIMITERS = [',', ';'] as const;

export function detectCsvHeader(buffer: Buffer): {
  delimiter: (typeof DELIMITERS)[number];
  columns: string[];
} | null {
  let best: { delimiter: (typeof DELIMITERS)[number]; columns: string[]; matches: number } | null =
    null;
  let ambiguous = false;

  for (const delimiter of DELIMITERS) {
    try {
      const [columns] = parse(buffer, {
        bom: true,
        delimiter,
        skip_empty_lines: true,
        to: 1,
        trim: true,
      });
      if (!columns || columns.length < 2) continue;

      const matches = REQUIRED_CSV_HEADERS.filter((header) => columns.includes(header)).length;
      if (!best || matches > best.matches) {
        best = { delimiter, columns, matches };
        ambiguous = false;
      } else if (matches === best.matches) {
        ambiguous = true;
      }
    } catch {
      // Wrong delimiter can make a quoted header invalid.
    }
  }

  return ambiguous ? null : best;
}

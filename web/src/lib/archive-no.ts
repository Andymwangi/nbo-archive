/*
  Archive numbers: NBO- plus at least four digits (NBO-0007, NBO-12345). Mirrors
  api/apps/catalog/specs.py so a number typed anywhere resolves the same way on both sides.
*/

const PREFIX = "NBO-";
const DIGITS = 4;
const PATTERN = /^(?:NBO-?)?0*(\d{1,9})$/i;

/** Accept `NBO-0142`, `nbo0142`, `0142` or `142`. Returns null for anything else. */
export function parseArchiveNo(value: string): number | null {
  const match = PATTERN.exec(value.trim());
  if (!match) return null;
  const number = Number(match[1]);
  return number > 0 ? number : null;
}

export function formatArchiveNo(number: number): string {
  return `${PREFIX}${String(number).padStart(DIGITS, "0")}`;
}

/** The canonical spelling of a typed number, or null when it is not one. */
export function canonicalArchiveNo(value: string): string | null {
  const number = parseArchiveNo(value);
  return number === null ? null : formatArchiveNo(number);
}

/** `NBO-0142` -> `{ prefix: "NBO-", digits: "0142" }`, for typesetting the two parts apart. */
export function splitArchiveNo(archiveNo: string): { prefix: string; digits: string } {
  return archiveNo.startsWith(PREFIX)
    ? { prefix: PREFIX, digits: archiveNo.slice(PREFIX.length) }
    : { prefix: "", digits: archiveNo };
}

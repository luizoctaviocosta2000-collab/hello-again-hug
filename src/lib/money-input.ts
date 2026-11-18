/**
 * Parse a positive money amount from a CRM form without silently multiplying it
 * by 100. Brazilian format (1.234,56), ungrouped comma (1234,56) and ungrouped
 * decimal dot (1234.56) are accepted. Ambiguous dot-grouped integer (1.234)
 * is interpreted as BRL 1234, while invalid groupings are rejected.
 *
 * Returns integer centavos for safe validation and submission.
 */
export function parseMoneyCents(input: string): number | null {
  const raw = input.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (!raw || /[^0-9.,]/.test(raw)) return null;

  let normalized: string;
  if (/^\d{1,3}(?:\.\d{3})+,(?:\d{1,2})$/.test(raw)) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else if (/^\d+(?:,\d{1,2})?$/.test(raw)) {
    normalized = raw.replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(raw)) {
    normalized = raw;
  } else {
    return null;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

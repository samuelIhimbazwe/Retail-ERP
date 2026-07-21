/** Client-safe barcode helpers (no DB). Server lookup lives in `@/lib/actions`. */

export function normalizeBarcode(code: string) {
  return code.trim().replace(/\s/g, "");
}

export function barcodeVariants(code: string) {
  const c = normalizeBarcode(code);
  const variants = new Set<string>([c]);
  if (c.length === 12) variants.add(`0${c}`);
  if (c.length === 13 && c.startsWith("0")) variants.add(c.slice(1));
  return [...variants];
}

/** Seeded demo barcode for scanner testing (Rice 25kg Premium). */
export const DEMO_BARCODE = "6001234567890";

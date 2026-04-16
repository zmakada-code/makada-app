export type FieldErrors = Record<string, string>;

export function requireString(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  { min = 1, max = 500 }: { min?: number; max?: number } = {}
): string {
  const str = (value ?? "").toString().trim();
  if (str.length < min) errors[field] = `Required.`;
  else if (str.length > max) errors[field] = `Must be ${max} characters or fewer.`;
  return str;
}

export function optionalString(value: FormDataEntryValue | null, max = 2000): string | null {
  const str = (value ?? "").toString().trim();
  if (!str) return null;
  if (str.length > max) return str.slice(0, max);
  return str;
}

export function parseNumber(
  errors: FieldErrors,
  field: string,
  value: FormDataEntryValue | null,
  { min = 0, integer = false }: { min?: number; integer?: boolean } = {}
): number {
  const raw = (value ?? "").toString().trim();
  if (raw === "") {
    errors[field] = `Required.`;
    return 0;
  }
  const n = integer ? parseInt(raw, 10) : parseFloat(raw);
  if (Number.isNaN(n)) {
    errors[field] = `Must be a number.`;
    return 0;
  }
  if (n < min) {
    errors[field] = `Must be ≥ ${min}.`;
    return 0;
  }
  return n;
}

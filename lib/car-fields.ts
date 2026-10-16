// Cleaning and checking the car form (F-A3). The database enforces the same storage format
// (cars.plate: upper case letters and digits only); these accept the ways plates are written.

// "HR 26 AB 1234", "hr-26-ab-1234", "HR.26.AB.1234" → "HR26AB1234".
export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[\s\-.]/g, "");
}

// Indian number plates, already normalised:
// - the usual state format: 2 letters, 1–2 digits, 0–3 letters, 1–4 digits (HR26AB1234,
//   DL3CAB1234, HR261234)
// - Bharat (BH) series: 2 digits, BH, 4 digits, 1–2 letters (22BH1234AA)
export function isIndianPlate(plate: string): boolean {
  return (
    /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(plate) ||
    /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(plate)
  );
}

// Model and colour: trimmed, spaces collapsed, within the database's length limits.
export function cleanCarText(
  value: string,
  min: number,
  max: number,
): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= min && text.length <= max ? text : null;
}

export const MAX_CAR_PHOTOS = 6;

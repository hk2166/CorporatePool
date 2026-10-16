#!/usr/bin/env node
// Checks supabase/seed/landmarks.csv (task.md H-5) before agents seed it.
// Usage: node scripts/check-landmarks.mjs [--strict] [path-to-csv]
// Exits with code 1 if anything must be fixed; warnings alone don't fail.
// --strict also fails on demo stops (names starting "Demo"); the launch task (T-8.2) uses it.
import { readFileSync } from "node:fs";
import { splitCsvLine } from "./lib/csv.mjs";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const path =
  args.find((a) => !a.startsWith("--")) ?? "supabase/seed/landmarks.csv";
const COLUMNS = ["name", "kind", "lat", "lng", "notes"];
const KINDS = ["town", "landmark", "metro", "office"];
// A rough box around Palwal, Faridabad and Gurgaon. A point outside it is
// almost always swapped lat/lng or a typo.
const BOX = { latMin: 27.9, latMax: 28.7, lngMin: 76.8, lngMax: 77.6 };
const TOO_CLOSE_M = 50;

// Straight-line distance in metres; accurate enough at this scale.
function metresBetween(a, b) {
  const kmPerDeg = 111.32;
  const dLat = (a.lat - b.lat) * kmPerDeg;
  const dLng = (a.lng - b.lng) * kmPerDeg * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng) * 1000;
}

let text;
try {
  text = readFileSync(path, "utf8");
} catch {
  console.error(`✗ Can't read ${path}`);
  process.exit(1);
}

const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
const errors = [];
const warnings = [];

if (splitCsvLine(lines[0] ?? "").join(",") !== COLUMNS.join(",")) {
  errors.push(`The first line must be exactly: ${COLUMNS.join(",")}`);
}

const stops = [];
lines.slice(1).forEach((line, i) => {
  const row = i + 2; // line number in the file, counting the header as 1
  const fields = splitCsvLine(line);
  // notes is optional, so a line may stop after lng
  if (fields.length > COLUMNS.length) {
    errors.push(
      `Line ${row}: ${fields.length} columns, expected ${COLUMNS.length}; put notes that contain commas in "quotes"`,
    );
    return;
  }
  if (fields.length < COLUMNS.length - 1) {
    errors.push(`Line ${row}: needs at least name, kind, lat and lng`);
    return;
  }
  const [name, kind, latText, lngText] = fields;
  const lat = Number(latText);
  const lng = Number(lngText);

  if (!name) errors.push(`Line ${row}: name is empty`);
  if (!KINDS.includes(kind))
    errors.push(
      `Line ${row}: kind "${kind}" must be one of ${KINDS.join(", ")}`,
    );
  if (
    latText === "" ||
    lngText === "" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    errors.push(`Line ${row}: lat and lng must be numbers`);
    return;
  }
  if (
    lat < BOX.latMin ||
    lat > BOX.latMax ||
    lng < BOX.lngMin ||
    lng > BOX.lngMax
  ) {
    errors.push(
      `Line ${row}: ${lat}, ${lng} is outside the Palwal–Gurgaon area (lat and lng swapped?)`,
    );
    return;
  }
  const decimals = Math.min(
    (latText.split(".")[1] ?? "").length,
    (lngText.split(".")[1] ?? "").length,
  );
  if (decimals < 4)
    warnings.push(
      `Line ${row}: "${name}" has only ${decimals} decimal place${decimals === 1 ? "" : "s"}; use 5 so the point is accurate to about a metre`,
    );

  for (const other of stops) {
    if (other.name.toLowerCase() === name.toLowerCase()) {
      errors.push(`Line ${row}: "${name}" is already on line ${other.row}`);
    } else if (metresBetween(other, { lat, lng }) < TOO_CLOSE_M) {
      warnings.push(
        `Line ${row}: "${name}" is within ${TOO_CLOSE_M} m of "${other.name}" (line ${other.row}); same stop twice?`,
      );
    }
  }
  stops.push({ row, name, lat, lng });
});

if (lines.length > 0 && stops.length === 0 && errors.length === 0) {
  errors.push(
    "No stops yet. Add one line per stop under the header (see docs/setup.md, H-5)",
  );
}
const demoCount = stops.filter((s) => /^demo\b/i.test(s.name)).length;
if (demoCount > 0) {
  const message = `${demoCount} demo stop(s): replace them with real stops before launch (H-5)`;
  (strict ? errors : warnings).push(message);
}
if (stops.length > 0 && stops.length < 20) {
  warnings.push(
    `${stops.length} stops; aim for 20–40 so riders along the route find a stop near them`,
  );
}

for (const w of warnings) console.log(`! ${w}`);
for (const e of errors) console.log(`✗ ${e}`);
if (errors.length > 0) {
  console.log(`\n${errors.length} problem(s) to fix in ${path}`);
  process.exit(1);
}
console.log(`✓ ${stops.length} stops look good`);

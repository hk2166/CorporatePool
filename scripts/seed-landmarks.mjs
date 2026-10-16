#!/usr/bin/env node
// Builds supabase/seed/10_landmarks.sql from supabase/seed/landmarks.csv (T-1.4).
//
// The CSV is the one place stops are edited (task.md H-5). The Supabase CLI can only load SQL
// seed files, so this turns the CSV into one.
//   node scripts/seed-landmarks.mjs          write the SQL file
//   node scripts/seed-landmarks.mjs --check  exit 1 if the SQL file is out of date (CI)
import { readFileSync, writeFileSync } from "node:fs";
import { splitCsvLine } from "./lib/csv.mjs";

const CSV_PATH = "supabase/seed/landmarks.csv";
const SQL_PATH = "supabase/seed/10_landmarks.sql";
const COLUMNS = "name,kind,lat,lng,notes";
const NUMBER = /^-?\d+(\.\d+)?$/;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const lines = readFileSync(CSV_PATH, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "");
const [header, ...rows] = lines.map(splitCsvLine);
if (header.join(",") !== COLUMNS) {
  fail(`${CSV_PATH} must start with the header: ${COLUMNS}`);
}

// Single quotes are doubled, the SQL way.
const quote = (text) => `'${text.replaceAll("'", "''")}'`;

const values = rows.map(([name, kind, lat, lng], index) => {
  if (!NUMBER.test(lat) || !NUMBER.test(lng)) {
    fail(`${CSV_PATH} line ${index + 2}: lat and lng must be numbers`);
  }
  // PostGIS takes longitude first. The numbers are copied as written, so the SQL only
  // changes when the CSV does.
  const point = `extensions.st_setsrid(extensions.st_makepoint(${lng}, ${lat}), 4326)`;
  return `  (${quote(name)}, ${quote(kind)}, ${point}::extensions.geography)`;
});

const sql = `-- GENERATED from supabase/seed/landmarks.csv by \`npm run seed:landmarks\`. Don't edit this
-- file: change the CSV and run the command again. CI fails if this file is out of date.
-- Safe to run again (stops that already exist are skipped), so it can also be pasted into the
-- live project's SQL editor (docs/deploy.md).
insert into public.places (name, kind, geo) values
${values.join(",\n")}
on conflict (name) do nothing;
`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(SQL_PATH, "utf8");
  } catch {
    // A missing file is just out of date.
  }
  if (current !== sql) {
    fail(`${SQL_PATH} is out of date. Run: npm run seed:landmarks`);
  }
  console.log(`✓ ${SQL_PATH} matches ${CSV_PATH} (${rows.length} stops)`);
} else {
  writeFileSync(SQL_PATH, sql);
  console.log(`✓ Wrote ${rows.length} stops to ${SQL_PATH}`);
}

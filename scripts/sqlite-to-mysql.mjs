// One-off copy of the old SQLite database (prisma/dev.db) into the MySQL database in DATABASE_URL.
// Usage: node scripts/sqlite-to-mysql.mjs [path/to/dev.db]
// Safe to re-run: rows whose primary key already exists are skipped.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";

const source = process.argv[2] || "prisma/dev.db";
if (!existsSync(source)) {
  console.error(`SQLite file not found: ${source}`);
  process.exit(1);
}

const ORDER = [
  "Tier",
  "TierFeature",
  "Member",
  "Membership",
  "PhysicalCard",
  "Staff",
  "ConciergeRequest",
  "ServiceCategory",
  "VerificationLog",
  "ActivityLog",
  "Booking",
  "Message",
  "Preference",
  "SiteSetting",
  "Payment",
  "PaymentAudit",
  "ChatThread",
  "ChatLine",
  "AdminEscalation",
  "ServiceHistory",
  "Service",
  "MemberDocument",
  "StaffDocument",
];

const ENUM_RENAMES = { StaffStatus: { SUSPENDED: "INACTIVE" } };

const sqlite = new DatabaseSync(source, { readOnly: true });
const prisma = new PrismaClient();
const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

function tableExists(name) {
  return Boolean(
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name),
  );
}

function convert(field, value) {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case "DateTime":
      return new Date(typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value);
    case "Boolean":
      return value === true || value === 1 || value === "1" || value === "true";
    case "Int":
      return Math.trunc(Number(value));
    case "Float":
      return Number(value);
    case "String":
      return String(value);
    default:
      if (field.kind === "enum") return ENUM_RENAMES[field.type]?.[value] ?? value;
      return value;
  }
}

function delegateFor(modelName) {
  return prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
}

let total = 0;
for (const name of ORDER) {
  const model = models.get(name);
  if (!model) continue;
  const table = model.dbName || model.name;
  if (!tableExists(table)) {
    console.log(`- ${name}: no table in SQLite, skipped`);
    continue;
  }
  const present = new Set(
    sqlite.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name),
  );
  const fields = model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
  const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
  const data = rows.map((row) => {
    const out = {};
    for (const f of fields) {
      const column = f.dbName || f.name;
      if (!present.has(column)) continue;
      const v = convert(f, row[column]);
      if (v === null && f.isRequired) continue;
      out[f.name] = v;
    }
    return out;
  });

  let inserted = 0;
  for (let i = 0; i < data.length; i += 200) {
    const res = await delegateFor(name).createMany({ data: data.slice(i, i + 200), skipDuplicates: true });
    inserted += res.count;
  }
  total += inserted;
  console.log(`✓ ${name}: ${inserted}/${rows.length} rows`);
}

console.log(`Done — ${total} rows copied from ${source}.`);
await prisma.$disconnect();
sqlite.close();

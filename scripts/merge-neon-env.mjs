import fs from "node:fs";

function parse(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[m[1]] = v;
  }
  return o;
}

function quote(v) {
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const env = parse(".env");
const local = parse(".env.local");

if (local.POSTGRES_PRISMA_URL) env.DATABASE_URL = local.POSTGRES_PRISMA_URL;
else if (local.DATABASE_URL) env.DATABASE_URL = local.DATABASE_URL;
else if (local.POSTGRES_URL) env.DATABASE_URL = local.POSTGRES_URL;

if (local.POSTGRES_URL_NON_POOLING)
  env.DATABASE_URL_UNPOOLED = local.POSTGRES_URL_NON_POOLING;
else if (local.DATABASE_URL_UNPOOLED)
  env.DATABASE_URL_UNPOOLED = local.DATABASE_URL_UNPOOLED;

if (!env.DATABASE_URL_UNPOOLED && env.DATABASE_URL) {
  env.DATABASE_URL_UNPOOLED = env.DATABASE_URL;
}

const keys = Object.keys(env).sort();
fs.writeFileSync(".env", keys.map((k) => `${k}=${quote(env[k])}`).join("\n") + "\n");

console.log(
  "db_ready",
  Boolean(env.DATABASE_URL),
  Boolean(env.DATABASE_URL_UNPOOLED)
);

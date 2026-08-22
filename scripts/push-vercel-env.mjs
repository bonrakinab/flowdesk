import { spawnSync } from "node:child_process";
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

const env = parse(".env");
const keys = [
  "AUTH_SECRET",
  "AUTH_TRUST_HOST",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "CRON_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_SECURE",
  "SMTP_FROM",
];

const targets = ["production", "preview", "development"];

for (const key of keys) {
  const value = env[key];
  if (!value) {
    console.log(`skip ${key}`);
    continue;
  }
  for (const target of targets) {
    const args = [
      "--yes",
      "vercel",
      "env",
      "add",
      key,
      target,
      "--force",
      "--yes",
      "--value",
      value,
    ];
    if (["AUTH_SECRET", "AUTH_GOOGLE_SECRET", "VAPID_PRIVATE_KEY", "SMTP_PASS", "CRON_SECRET"].includes(key)) {
      args.push("--sensitive");
    }
    const r = spawnSync("npx", args, {
      encoding: "utf8",
      shell: true,
    });
    if (r.status === 0) console.log(`ok ${key} ${target}`);
    else
      console.log(
        `fail ${key} ${target}: ${(r.stderr || r.stdout || "").slice(0, 180)}`
      );
  }
}

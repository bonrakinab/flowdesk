import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

const url = process.env.FLOWDESK_URL || process.env.CAPACITOR_SERVER_URL;
if (url) {
  console.log(`Using FLOWDESK_URL=${url}`);
} else {
  console.log(
    "FLOWDESK_URL not set — using default in capacitor.config.ts (LAN IP)."
  );
}

const result = spawnSync("npx", ["cap", "sync", "android"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);

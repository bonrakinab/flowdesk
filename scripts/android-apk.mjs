import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

const portableJdk = join(
  process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
  "Java",
  "jdk-21.0.12+8"
);
if (existsSync(join(portableJdk, "bin", "java.exe"))) {
  process.env.JAVA_HOME = portableJdk;
  console.log(`Using JAVA_HOME=${portableJdk}`);
}

const sdk = join(
  process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
  "Android",
  "Sdk"
);
if (existsSync(sdk)) {
  process.env.ANDROID_HOME = sdk;
  process.env.ANDROID_SDK_ROOT = sdk;
}

const sync = spawnSync("node", ["scripts/android-sync.mjs"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if (sync.status) process.exit(sync.status);

const gradle = spawnSync("gradlew.bat", ["assembleDebug", "--no-daemon"], {
  cwd: resolve(process.cwd(), "android"),
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(gradle.status ?? 1);

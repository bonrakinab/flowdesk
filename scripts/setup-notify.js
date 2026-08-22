const webpush = require("web-push");
const crypto = require("crypto");
const fs = require("fs");

const envPath = ".env";
let env = fs.readFileSync(envPath, "utf8");

if (!env.includes("VAPID_PUBLIC_KEY")) {
  const k = webpush.generateVAPIDKeys();
  const cron = crypto.randomBytes(24).toString("hex");
  env += `
ENABLE_PWA_DEV=true
VAPID_PUBLIC_KEY="${k.publicKey}"
VAPID_PRIVATE_KEY="${k.privateKey}"
VAPID_SUBJECT="mailto:admin@localhost"
CRON_SECRET="${cron}"
# SMTP — uncomment and fill:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=you@gmail.com
# SMTP_PASS=your-app-password
# SMTP_FROM=Flowdesk <you@gmail.com>
`;
  fs.writeFileSync(envPath, env);
  console.log("Wrote VAPID + CRON_SECRET to .env");
} else {
  console.log("VAPID already present in .env");
}

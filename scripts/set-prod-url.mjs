import fs from "node:fs";

const updates = {
  AUTH_URL: "https://flowdesk-banik.vercel.app",
  FLOWDESK_URL: "https://flowdesk-banik.vercel.app",
};

let t = fs.readFileSync(".env", "utf8");
for (const [k, v] of Object.entries(updates)) {
  const re = new RegExp(`^${k}=.*$`, "m");
  const line = `${k}="${v}"`;
  if (re.test(t)) t = t.replace(re, line);
  else t += `\n${line}\n`;
}
fs.writeFileSync(".env", t);
console.log("updated AUTH_URL and FLOWDESK_URL to banik domain");

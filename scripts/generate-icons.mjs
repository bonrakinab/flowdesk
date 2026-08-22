import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = process.cwd();
const src = path.join(root, "public", "icons", "flowdesk-logo.png");

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function writePng(out, size) {
  await ensureDir(path.dirname(out));
  await sharp(src)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(out);
  console.log("wrote", path.relative(root, out), `${size}x${size}`);
}

async function writePaddedForeground(out, canvasSize) {
  await ensureDir(path.dirname(out));
  const inner = Math.round(canvasSize * 0.72);
  const buf = await sharp(src).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: buf, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log("wrote", path.relative(root, out), `fg ${canvasSize}`);
}

async function main() {
  if (!fs.existsSync(src)) throw new Error(`Missing logo at ${src}`);

  await writePng(path.join(root, "public", "icons", "icon-192.png"), 192);
  await writePng(path.join(root, "public", "icons", "icon-512.png"), 512);
  await writePng(path.join(root, "public", "favicon.png"), 32);
  await writePng(path.join(root, "public", "apple-touch-icon.png"), 180);
  await writePng(path.join(root, "src", "app", "icon.png"), 512);
  await writePng(path.join(root, "src", "app", "apple-icon.png"), 180);

  const ico = await pngToIco([
    await sharp(src).resize(16, 16).png().toBuffer(),
    await sharp(src).resize(32, 32).png().toBuffer(),
    await sharp(src).resize(48, 48).png().toBuffer(),
  ]);
  await fs.promises.writeFile(path.join(root, "src", "app", "favicon.ico"), ico);
  await fs.promises.writeFile(path.join(root, "public", "favicon.ico"), ico);
  console.log("wrote favicon.ico");

  const androidSizes = [
    ["mipmap-mdpi", 48, 108],
    ["mipmap-hdpi", 72, 162],
    ["mipmap-xhdpi", 96, 216],
    ["mipmap-xxhdpi", 144, 324],
    ["mipmap-xxxhdpi", 192, 432],
  ];
  for (const [folder, launcher, fg] of androidSizes) {
    const dir = path.join(root, "android", "app", "src", "main", "res", folder);
    await writePng(path.join(dir, "ic_launcher.png"), launcher);
    await writePng(path.join(dir, "ic_launcher_round.png"), launcher);
    await writePaddedForeground(path.join(dir, "ic_launcher_foreground.png"), fg);
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Dev: off unless ENABLE_PWA_DEV. Vercel Node 24 has hit intermittent Serwist
  // bundler crashes — keep SW on unless DISABLE_SERWIST=true.
  disable:
    process.env.DISABLE_SERWIST === "true" ||
    (process.env.NODE_ENV === "development" &&
      process.env.ENABLE_PWA_DEV !== "true"),
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_ENABLED: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ).toString(),
    NEXT_PUBLIC_PUSH_ENABLED: Boolean(
      process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ).toString(),
  },
};

export default withSerwist(nextConfig);

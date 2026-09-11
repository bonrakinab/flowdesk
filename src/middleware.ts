import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

// Let this middleware own the unauthenticated redirect so we can preserve the
// hostname the user actually opened. Auth.js' default authorized=false redirect
// uses AUTH_URL as its base, which was sending rose-domain requests to the old
// banik domain before this callback could run.
const { auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized() {
      return true;
    },
  },
});

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  if (
    isLoggedIn &&
    (pathname === "/login" ||
      pathname === "/signup" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password" ||
      pathname === "/")
  ) {
    return NextResponse.redirect(new URL("/today", req.nextUrl.origin));
  }

  const isPublicApi =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/signup") ||
    pathname.startsWith("/api/weather") ||
    pathname.startsWith("/api/wallpaper") ||
    pathname.startsWith("/api/push/vapid") ||
    pathname.startsWith("/api/cron/");

  if (
    !isLoggedIn &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/forgot-password") &&
    !pathname.startsWith("/reset-password") &&
    !isPublicApi &&
    pathname !== "/"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|~offline).*)",
  ],
};

import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
    newUser: "/today",
    error: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/signup") ||
        pathname.startsWith("/api/weather") ||
        pathname.startsWith("/api/wallpaper") ||
        pathname.startsWith("/api/push/vapid") ||
        pathname.startsWith("/api/cron/");

      if (pathname.startsWith("/api/") && !isPublic) {
        return isLoggedIn;
      }

      if (!isLoggedIn && !isPublic && pathname !== "/") {
        const forwardedHost = request.headers
          .get("x-forwarded-host")
          ?.split(",")[0]
          ?.trim();
        const host = forwardedHost || request.headers.get("host");
        const forwardedProto = request.headers
          .get("x-forwarded-proto")
          ?.split(",")[0]
          ?.trim();
        const protocol =
          forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";
        const origin = host
          ? `${protocol}://${host}`
          : request.nextUrl.origin;
        const url = new URL("/login", origin);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) token.sub = user.id;
      if (trigger === "update" && session) {
        token.user = { ...(token.user as object), ...session } as typeof token.user;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.user) {
        const u = token.user as {
          id: string;
          name: string | null;
          email: string;
          color: string;
          image: string | null;
          householdId: string | null;
        };
        session.user = {
          ...session.user,
          id: u.id,
          name: u.name,
          email: u.email,
          color: u.color,
          image: u.image,
          householdId: u.householdId,
        };
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;

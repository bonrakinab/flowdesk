import type { NextAuthConfig } from "next-auth";

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
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/signup") ||
        pathname.startsWith("/api/weather") ||
        pathname.startsWith("/api/push/vapid");

      if (pathname.startsWith("/api/") && !isPublic) {
        return isLoggedIn;
      }

      if (!isLoggedIn && !isPublic && pathname !== "/") {
        return false;
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

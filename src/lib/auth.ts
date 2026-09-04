import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const providers = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });
      if (!user?.passwordHash) return null;

      const valid = await bcrypt.compare(
        parsed.data.password,
        user.passwordHash
      );
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }) as never
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers,
  // Keep OAuth check cookies readable after the Google redirect (esp. mobile / WebView).
  cookies: {
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 15,
      },
    },
    state: {
      name: "authjs.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 15,
      },
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const existing = await prisma.user.findUnique({ where: { id: user.id } });
      if (existing?.householdId) return;
      const household = await prisma.household.create({
        data: {
          name: `${user.name || "My"} Household`,
          inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
          folders: {
            create: [
              { name: "Personal" },
              { name: "Family" },
              { name: "Ideas" },
              { name: "Meeting notes" },
            ],
          },
          projects: {
            create: [
              { name: "Work", color: "#0284c7" },
              { name: "Home", color: "#d97706" },
              { name: "Family", color: "#e11d48" },
              { name: "Side", color: "#7c3aed" },
            ],
          },
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { householdId: household.id, color: "#0d9488" },
      });
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      try {
        const target = new URL(url);
        const allowedOrigins = new Set([
          new URL(baseUrl).origin,
          "https://flowdesk-banik.vercel.app",
          "https://flowdesk-rose.vercel.app",
        ]);
        if (allowedOrigins.has(target.origin)) return target.toString();
      } catch {
        // Fall back to the configured Auth.js base URL below.
      }

      return baseUrl;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (user) token.sub = user.id;

      // Persist Google tokens for Calendar sync (JWT sessions don't keep them otherwise).
      if (
        account?.provider === "google" &&
        token.sub &&
        (account.access_token || account.refresh_token)
      ) {
        await prisma.account.updateMany({
          where: { userId: token.sub, provider: "google" },
          data: {
            ...(account.access_token
              ? { access_token: account.access_token }
              : {}),
            ...(account.refresh_token
              ? { refresh_token: account.refresh_token }
              : {}),
            ...(typeof account.expires_at === "number"
              ? { expires_at: account.expires_at }
              : {}),
            ...(account.scope ? { scope: account.scope } : {}),
          },
        });
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            name: true,
            email: true,
            color: true,
            image: true,
            householdId: true,
          },
        });
        if (dbUser) token.user = dbUser;
      }
      if (trigger === "update" && session) {
        token.user = { ...(token.user as object), ...session } as typeof token.user;
      }
      return token;
    },
  },
});

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      color: string;
      householdId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: {
      id: string;
      name: string | null;
      email: string;
      color: string;
      image: string | null;
      householdId: string | null;
    };
  }
}

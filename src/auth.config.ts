import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-compatible auth config (no database access, no Node.js-only modules)
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname.startsWith("/login");
      const isSignupPage = nextUrl.pathname.startsWith("/signup");
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

      if (isApiAuth) return true;
      if (isLoginPage) return true;
      if (isSignupPage) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.companyId = (user as { companyId?: string }).companyId;
        token.userId = user.id;
        token.lastName = (user as { lastName?: string | null }).lastName ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as Role;
        session.user.companyId = token.companyId as string;
        session.user.id = token.userId as string;
        session.user.lastName = (token.lastName as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};

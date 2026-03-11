import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// Project tabs that PARTNER role is NOT allowed to access
const PARTNER_BLOCKED_SEGMENTS = [
  "dashboard", "subs-bids", "client-bid", "expenses",
  "projections", "reports", "settings", "audit", "estimates",
];

export default auth((req: NextRequest & { auth?: { user?: { role?: string } } | null }) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (role === "PARTNER") {
    // Pattern: /{companyId}/{projectId}/{segment}
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 3) {
      const segment = parts[2];
      if (PARTNER_BLOCKED_SEGMENTS.includes(segment)) {
        const companyId = parts[0];
        const projectId = parts[1];
        return NextResponse.redirect(
          new URL(`/${companyId}/${projectId}/ledger`, req.url)
        );
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  // Exclude: auth APIs, cron, Next.js internals, static files (images, fonts, etc.)
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp|.*\\.gif).*)$",
  ],
};

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/gmail";

// GET /api/google-oauth?companyId=xxx — start Google OAuth re-auth flow
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyId = new URL(req.url).searchParams.get("companyId") ?? session.user.companyId;

  try {
    const url = buildGoogleAuthUrl(companyId);
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

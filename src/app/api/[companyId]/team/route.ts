import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailOAuth } from "@/lib/gmail";
import { google } from "googleapis";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["ADMIN", "PM", "BOOKKEEPER", "PARTNER"] as const;
type SubRole = typeof VALID_ROLES[number];

const PORTAL_BASE = process.env.PORTAL_BASE_URL ?? "https://portal.mibhconstruction.com";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { companyId: params.companyId, archivedAt: null, role: { in: VALID_ROLES as unknown as SubRole[] } },
    select: { id: true, email: true, name: true, lastName: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });

  const { name, email, role, sendInvite = true } = await req.json() as {
    name?: string; email?: string; role?: SubRole; sendInvite?: boolean;
  };

  if (!name?.trim() || !email?.trim()) return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  if (!EMAIL.test(email.trim())) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  if (!role || !VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const cleanEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const created = await prisma.user.create({
    data: {
      companyId: params.companyId,
      email: cleanEmail,
      name: name.trim(),
      role,
      passwordHash,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  let emailSent = false;
  if (sendInvite) {
    try {
      const oauth2Client = await getGmailOAuth(params.companyId);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const fromEmail = profile.data.emailAddress ?? "me";
      const loginUrl = `${PORTAL_BASE}/login`;
      const subject = `You've been added to the team — login details`;
      const body = `Hi ${name.trim()},\n\nYou've been added as a ${role} on the MIBH portal.\n\nLogin: ${loginUrl}\nEmail: ${cleanEmail}\nTemporary password: ${tempPassword}\n\nPlease change your password after first sign-in.\n\nThank you`;
      const mimeLines = [
        `From: ${fromEmail}`,
        `To: ${cleanEmail}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        body,
      ];
      const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      emailSent = true;
    } catch (err) {
      console.error("[team invite] email failed:", err);
    }
  }

  // Always return tempPassword to the admin so they can hand it over even if email failed
  return NextResponse.json({ user: created, tempPassword, emailSent });
}

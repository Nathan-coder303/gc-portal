import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string };
  if (!email) return NextResponse.json({ ok: true }); // always 200 to prevent enumeration

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return NextResponse.json({ ok: true });

  // Generate a secure token valid for 1 hour
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, token, expires },
    update: { token, expires },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL ?? "https://portal.mibhconstruction.com"}/reset-password?token=${token}`;

  // Send via Gmail SMTP using the app's Gmail account
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER ?? process.env.SMTP_USER,
        pass: process.env.GMAIL_APP_PASSWORD ?? process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: `"MIBH Portal" <${process.env.GMAIL_USER ?? process.env.SMTP_USER}>`,
      to: email,
      subject: "Reset your GC Portal password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#C9A84C">Reset your password</h2>
          <p>Click the link below to reset your GC Portal password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#C9A84C;color:#0d1117;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;margin:16px 0">
            Reset password
          </a>
          <p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Password reset email failed:", err);
    // Still return ok — token is saved, admin can send manually if needed
  }

  return NextResponse.json({ ok: true });
}

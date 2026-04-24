import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ found: false });

    const valid = await bcrypt.compare(password, user.passwordHash);
    return NextResponse.json({
      found: true,
      valid,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      hashPrefix: user.passwordHash.slice(0, 20),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

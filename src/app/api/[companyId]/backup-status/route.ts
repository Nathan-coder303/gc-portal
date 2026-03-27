import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statusFile = path.join(process.env.HOME || "/Users/mike", "gc-portal-backups", "last-backup.json");
  try {
    const raw = fs.readFileSync(statusFile, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(null);
  }
}

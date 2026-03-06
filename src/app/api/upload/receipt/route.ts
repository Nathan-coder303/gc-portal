import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Compute MD5 hash for duplicate detection
  const hash = createHash("md5").update(buffer).digest("hex");

  // In production (Vercel), filesystem writes don't persist — return hash + signal to use URL
  if (process.env.NODE_ENV === "production" && !process.env.UPLOAD_DIR) {
    // Return the hash so duplicate detection still works via hash
    // Client should use a URL field for receipt in production without S3
    return Response.json({
      hash,
      url: null,
      note: "Set UPLOAD_DIR or configure S3 for persistent receipt storage",
    });
  }

  // Dev: save to public/uploads/receipts/
  const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "receipts");
  await mkdir(uploadDir, { recursive: true });

  const ext = file.name.split(".").pop() ?? "bin";
  const filename = `${hash}.${ext}`;
  const filepath = join(uploadDir, filename);
  await writeFile(filepath, buffer);

  const url = `/uploads/receipts/${filename}`;
  return Response.json({ hash, url });
}

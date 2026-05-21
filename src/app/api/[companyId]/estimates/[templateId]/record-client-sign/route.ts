import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = await prisma.estimateTemplate.findFirst({
    where: { id: params.templateId, companyId: params.companyId },
    select: { id: true, signedAt: true, counterSignedAt: true, estimateNumber: true, client: { select: { name: true } } },
  });

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (template.counterSignedAt) return NextResponse.json({ error: "Already fully executed" }, { status: 409 });
  if (template.signedAt) return NextResponse.json({ error: "Already marked as signed" }, { status: 409 });

  let signedByName: string;
  let pdfFile: File | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    signedByName = (fd.get("signedByName") as string | null)?.trim() ?? "";
    pdfFile = (fd.get("pdfFile") as File | null);
  } else {
    const body = await req.json() as { signedByName?: string };
    signedByName = body.signedByName?.trim() ?? "";
  }

  if (!signedByName) return NextResponse.json({ error: "signedByName is required" }, { status: 400 });

  const signedAt = new Date();

  await prisma.estimateTemplate.update({
    where: { id: template.id },
    data: { signedAt, signedByName },
  });

  // Store the uploaded PDF in Blob for record-keeping (non-fatal if it fails)
  if (pdfFile && pdfFile.size > 0) {
    try {
      const clientSlug = template.client ? `-${template.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
      const estimateSlug = template.estimateNumber ? `estimate-${template.estimateNumber}` : template.id;
      const ab = await pdfFile.arrayBuffer();
      await put(
        `client-signed/${params.companyId}/${estimateSlug}${clientSlug}-client-signed.pdf`,
        ab,
        { access: "private", contentType: "application/pdf" }
      );
    } catch (err) {
      console.error("Failed to store client-signed PDF:", err);
    }
  }

  return NextResponse.json({ success: true, signedAt: signedAt.toISOString(), signedByName });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
        maximumSizeInBytes: 20 * 1024 * 1024,
        tokenPayload: JSON.stringify({ clientId: params.clientId }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const { clientId } = JSON.parse(tokenPayload ?? "{}");
          if (clientId) {
            await prisma.client.update({
              where: { id: clientId },
              data: { coverPhotoType: "CUSTOM", coverPhotoUrl: blob.url },
            });
          }
        } catch (e) {
          console.error("onUploadCompleted error:", e);
        }
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("Cover upload token error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

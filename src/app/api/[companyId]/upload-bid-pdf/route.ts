import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

async function extractDateFromPdf(base64: string, fileName: string): Promise<string | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey || !fileName.match(/\.pdf$/i)) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: 'What is the date on this bid/proposal document? Return ONLY the date as "Mon DD, YYYY" (e.g. "Mar 20, 2026"). If no date found, return null. No other text.' },
          ],
        }],
      }),
    });
    const json = await res.json() as { content?: { type: string; text: string }[] };
    const text = json.content?.[0]?.type === "text" ? json.content[0].text.trim() : null;
    if (!text || text.toLowerCase() === "null") return null;
    return text;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  try {
    // Read buffer once — used for both upload and Claude extraction
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Upload and date-extract in parallel
    const [blob, bidDate] = await Promise.all([
      put(`bid-pdfs/${Date.now()}-${file.name}`, Buffer.from(buffer), { access: "private", contentType: file.type || "application/octet-stream" }),
      extractDateFromPdf(base64, file.name),
    ]);

    const proxyUrl = `/api/${params.companyId}/blob-proxy?u=${encodeURIComponent(blob.url)}`;

    return NextResponse.json({ url: proxyUrl, fileName: file.name, bidDate });
  } catch (err) {
    console.error("Bid upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

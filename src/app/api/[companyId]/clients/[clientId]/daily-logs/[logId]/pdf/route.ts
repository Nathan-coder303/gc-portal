import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderDailyLogPdf } from "@/lib/daily-log-pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    include: { client: { select: { name: true, address: true, projectName: true } }, company: { select: { name: true, address: true, phone: true, email: true } } },
  });
  if (!log) return new NextResponse("Not found", { status: 404 });

  const company = {
    name: log.company.name,
    address: log.company.address ?? "",
    phone: log.company.phone ?? "",
    email: log.company.email ?? "",
  };

  const base = process.env.NEXTAUTH_URL ?? "https://gc-portal-two.vercel.app";
  const attachmentBaseUrl = `${base}/api/${params.companyId}/clients/${params.clientId}/daily-logs/${params.logId}/attachments`;
  const { buffer: pdfBuffer } = await renderDailyLogPdf(log, company, log.client, attachmentBaseUrl);

  const date = new Date(log.arrivalDate).toISOString().slice(0, 10);
  const projectSlug = (log.client.projectName || log.client.name).replace(/[^a-z0-9]/gi, "-");
  const filename = `Daily-Log-${projectSlug}-${date}.pdf`;

  const download = req.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

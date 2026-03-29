import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const company = await prisma.company.findFirst({
    where: { id: params.companyId },
    select: { requestTrackerUrl: true },
  });

  if (!company?.requestTrackerUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  const res = await fetch(company.requestTrackerUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Failed to fetch file", { status: 502 });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="GC_Portal_Request_Tracker.xlsx"`,
      "Cache-Control": "private, no-cache",
    },
  });
}

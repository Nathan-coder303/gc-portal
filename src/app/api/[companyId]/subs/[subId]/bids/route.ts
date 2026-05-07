import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; subId: string } }
) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await prisma.subContractor.findFirst({
    where: { id: params.subId, companyId: params.companyId },
    select: { name: true },
  });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type BidRow = {
    id: string;
    division_code: string;
    division_name: string;
    amount: string | null;
    notes: string | null;
    file_url: string | null;
    file_name: string | null;
    status: string;
    email_source: string | null;
    source_label: string | null;
    bid_date: string | null;
    created_at: Date;
    client_name: string | null;
    lead_name: string | null;
    project_name: string | null;
  };

  const rows = await prisma.$queryRaw<BidRow[]>(Prisma.sql`
    SELECT
      sb.id,
      sb."divisionCode"   AS division_code,
      sb."divisionName"   AS division_name,
      sb.amount::text     AS amount,
      sb.notes,
      sb."fileUrl"        AS file_url,
      sb."fileName"       AS file_name,
      sb.status,
      sb."emailSource"    AS email_source,
      sb."sourceLabel"    AS source_label,
      sb."bidDate"        AS bid_date,
      sb."createdAt"      AS created_at,
      c.name              AS client_name,
      l.name              AS lead_name,
      p.name              AS project_name
    FROM "SubBid" sb
    LEFT JOIN "Client"  c ON sb."clientId"  = c.id
    LEFT JOIN "Lead"    l ON sb."leadId"    = l.id
    LEFT JOIN "Project" p ON sb."projectId" = p.id
    WHERE sb."companyId" = ${params.companyId}
      AND LOWER(sb."contractorName") = LOWER(${sub.name})
    ORDER BY sb."createdAt" DESC
  `);

  return NextResponse.json(
    rows.map(r => ({
      id: r.id,
      divisionCode: r.division_code,
      divisionName: r.division_name,
      amount: r.amount ? parseFloat(r.amount) : null,
      notes: r.notes,
      fileUrl: r.file_url,
      fileName: r.file_name,
      status: r.status,
      emailSource: r.email_source,
      sourceLabel: r.source_label,
      bidDate: r.bid_date,
      createdAt: r.created_at,
      projectName: r.project_name ?? r.client_name ?? r.lead_name ?? null,
    }))
  );
}

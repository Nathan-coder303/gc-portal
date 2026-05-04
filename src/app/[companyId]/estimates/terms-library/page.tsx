import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { getFileTermsPresets } from "@/lib/fileTerms";
import TermsLibraryManager from "@/components/estimates/TermsLibraryManager";

export const dynamic = "force-dynamic";

export default async function TermsLibraryPage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user.role, "estimate:read")) redirect(`/${params.companyId}`);

  const canEdit = can(session.user.role, "estimateTemplate:edit");

  let templates = await prisma.termsTemplate.findMany({
    where: { companyId: params.companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, content: true },
  });

  // Auto-seed built-in file presets into DB on first visit
  if (templates.length === 0 && canEdit) {
    const presets = getFileTermsPresets().filter(p => p.content.trim());
    if (presets.length > 0) {
      await prisma.termsTemplate.createMany({
        data: presets.map(p => ({ companyId: params.companyId, name: p.name, content: p.content })),
      });
      templates = await prisma.termsTemplate.findMany({
        where: { companyId: params.companyId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, content: true },
      });
    }
  }

  return (
    <div className="w-full px-4 md:px-8 py-6 md:py-8">
      <TermsLibraryManager
        companyId={params.companyId}
        initialTemplates={templates}
        canEdit={canEdit}
      />
    </div>
  );
}

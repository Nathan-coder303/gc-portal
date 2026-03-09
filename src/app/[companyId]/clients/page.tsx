import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import ClientsManager from "./ClientsManager";

export default async function ClientsPage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const clients = await prisma.client.findMany({
    where: { companyId: params.companyId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { templates: { where: { type: "CLIENT_ESTIMATE", archivedAt: null } } } },
    },
  });

  const isAdmin = can(session.user.role, "estimateTemplate:edit");

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <ClientsManager
          companyId={params.companyId}
          clients={clients.map(c => ({
            id: c.id,
            name: c.name,
            address: c.address,
            city: c.city,
            state: c.state,
            zip: c.zip,
            email: c.email,
            phone: c.phone,
            estimateCount: c._count.templates,
          }))}
          isAdmin={isAdmin}
        />
    </div>
  );
}

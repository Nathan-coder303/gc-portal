import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MarketingTabs from "@/components/marketing/MarketingTabs";

export const dynamic = "force-dynamic";

export default async function MarketingPage({
  params,
  searchParams,
}: {
  params: { companyId: string };
  searchParams: { tab?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const activeTab = searchParams.tab ?? "agencies";

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 md:px-8 py-6 md:py-8 space-y-5">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>
        Marketing
      </h1>

      <MarketingTabs companyId={params.companyId} activeTab={activeTab} />
    </div>
  );
}

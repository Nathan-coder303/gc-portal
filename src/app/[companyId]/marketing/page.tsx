import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MarketingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="w-full px-4 md:px-8 py-6 md:py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>
        Marketing
      </h1>

      <div className="rounded-2xl p-8 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
        <div className="text-4xl mb-4">📣</div>
        <div className="text-lg font-semibold mb-2" style={{ color: "#e6edf3" }}>Coming Soon</div>
        <p className="text-sm" style={{ color: "#8b949e" }}>
          Marketing tools will be available here — proposals, follow-ups, and more.
        </p>
      </div>
    </div>
  );
}

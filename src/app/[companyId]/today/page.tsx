import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TodayPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#e6edf3" }}>
        Today&apos;s Tasks
      </h1>
      <p className="text-sm mb-8" style={{ color: "#8b949e" }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div className="rounded-xl p-10 text-center" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <p className="text-sm" style={{ color: "#8b949e" }}>Coming soon — tell us what to put here.</p>
      </div>
    </div>
  );
}

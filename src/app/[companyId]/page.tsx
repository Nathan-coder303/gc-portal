import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { createTemplateByName } from "@/app/[companyId]/estimates/actions";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";

export default async function HubPage({
  params,
  searchParams,
}: {
  params: { companyId: string };
  searchParams?: { tab?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect("/");

  const isAdmin = can(session.user.role, "project:edit");
  const activeTab = searchParams?.tab ?? "projects";

  const [projects, company, templates] = await Promise.all([
    prisma.project.findMany({
      where: { companyId: params.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        estimates: { where: { archivedAt: null }, select: { id: true } },
      },
    }),
    prisma.company.findUnique({ where: { id: params.companyId } }),
    prisma.estimateTemplate.findMany({
      where: { companyId: params.companyId, type: "TEMPLATE", archivedAt: null },
      select: { id: true, name: true },
    }),
  ]);

  const templateByName = (name: string) => templates.find((t) => t.name === name);

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-900/50 text-green-400 border border-green-700/50",
    ON_HOLD: "bg-amber-900/50 text-amber-400 border border-amber-700/50",
    COMPLETE: "bg-[#30373f] text-[#8b949e] border border-[#30373f]",
  };

  const navItems = [
    { tab: "projects", label: "Projects", icon: "📋" },
    { tab: "estimates", label: "Estimates", icon: "📊" },
    { tab: "calendar", label: "Calendar", icon: "📅" },
    { tab: "memory", label: "Memory", icon: "🧠" },
  ];

  const soonItems = [
    { label: "Discord", icon: "💬" },
    { label: "Telegram", icon: "✈️" },
    { label: "Teams", icon: "👥" },
  ];

  const estimateCategories = [
    {
      name: "Addition",
      icon: "🏗️",
      desc: "Residential additions & extensions",
      comingSoon: false,
    },
    {
      name: "Custom Homes",
      icon: "🏠",
      desc: "Custom home builds",
      comingSoon: true,
    },
    {
      name: "Kitchen Remodeling",
      icon: "🍳",
      desc: "Kitchen renovation estimates",
      comingSoon: false,
    },
    {
      name: "Bathroom Remodeling",
      icon: "🚿",
      desc: "Bathroom renovation estimates",
      comingSoon: false,
    },
  ];

  return (
    <div className="flex h-screen bg-[#0d1117] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col bg-[#161b22] border-r border-[#30373f]"
        style={{ minHeight: "100vh" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          <div
            className="rounded-xl overflow-hidden mb-3"
            style={{ border: "1.5px solid #C9A84C44", padding: "3px", background: "#1e2736" }}
          >
            <Image
              src="/logo.png"
              alt="MIBH Logo"
              width={70}
              height={70}
              className="rounded-lg object-contain"
            />
          </div>
          <span className="text-xs font-semibold tracking-wide" style={{ color: "#C9A84C" }}>
            {company?.name ?? "GC Portal"}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 space-y-1">
          {navItems.map(({ tab, label, icon }) => {
            const isActive = activeTab === tab;
            return (
              <Link
                key={tab}
                href={`?tab=${tab}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "text-[#0d1117] font-semibold"
                    : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1e2736]"
                }`}
                style={isActive ? { background: "#C9A84C" } : {}}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}

          <div className="pt-2 pb-1">
            <div className="text-[10px] uppercase tracking-widest text-[#30373f] px-3 pb-1 font-bold">
              Coming Soon
            </div>
            {soonItems.map(({ label, icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm opacity-40 cursor-not-allowed"
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="text-[#8b949e]">{label}</span>
                <span
                  className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                >
                  Soon
                </span>
              </div>
            ))}
          </div>
        </nav>

        {/* Bottom user section */}
        <div className="px-3 pb-5 border-t border-[#30373f] pt-4">
          <div className="flex flex-col gap-2">
            <div>
              <div className="text-sm font-medium text-[#e6edf3] truncate">{session.user.name}</div>
              <span
                className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}
              >
                {session.user.role}
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors mt-1">
                Sign out →
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">

          {/* ───── Projects tab ───── */}
          {activeTab === "projects" && (
            <div className="space-y-8">
              <h1 className="text-3xl font-bold text-[#e6edf3] tracking-tight">Projects</h1>

              {/* Big action cards */}
              <div className="grid grid-cols-2 gap-5">
                {/* Existing Projects */}
                <Link
                  href={`/${params.companyId}/projects`}
                  className="group block rounded-2xl p-7 transition-all duration-200 hover:border-[#C9A84C]"
                  style={{
                    background: "#1e2736",
                    border: "1px solid #30373f",
                  }}
                >
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 text-2xl"
                    style={{ background: "#C9A84C1a" }}
                  >
                    📋
                  </div>
                  <div
                    className="text-xl font-bold text-[#e6edf3] mb-1 group-hover:text-[#C9A84C] transition-colors"
                  >
                    Existing Projects
                  </div>
                  <div className="text-[#8b949e] text-sm">
                    {projects.length} project{projects.length !== 1 ? "s" : ""}
                  </div>
                </Link>

                {/* New Project */}
                {isAdmin ? (
                  <Link
                    href={`/${params.companyId}/projects/new`}
                    className="group block rounded-2xl p-7 transition-all duration-200"
                    style={{ background: "#C9A84C" }}
                  >
                    <div
                      className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 text-2xl"
                      style={{ background: "rgba(0,0,0,0.15)" }}
                    >
                      ➕
                    </div>
                    <div className="text-xl font-bold text-[#0d1117] mb-1">New Project</div>
                    <div className="text-[#0d1117]/70 text-sm">Start a new project</div>
                  </Link>
                ) : (
                  <div
                    className="rounded-2xl p-7 opacity-40"
                    style={{ background: "#1e2736", border: "1px solid #30373f" }}
                  >
                    <div
                      className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 text-2xl"
                      style={{ background: "#C9A84C1a" }}
                    >
                      ➕
                    </div>
                    <div className="text-xl font-bold text-[#e6edf3] mb-1">New Project</div>
                    <div className="text-[#8b949e] text-sm">Admin only</div>
                  </div>
                )}
              </div>

              {/* Projects list */}
              <div>
                <h2 className="text-base font-semibold text-[#8b949e] mb-4 uppercase tracking-wider text-xs">
                  Recent Projects
                </h2>
                {projects.length === 0 ? (
                  <div
                    className="rounded-2xl p-12 text-center text-[#8b949e]"
                    style={{ background: "#1e2736", border: "1px solid #30373f" }}
                  >
                    No projects yet.{" "}
                    {isAdmin && (
                      <Link
                        href={`/${params.companyId}/projects/new`}
                        style={{ color: "#C9A84C" }}
                        className="hover:underline"
                      >
                        Create your first project
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-4 rounded-xl px-5 py-4 transition-all duration-150 hover:border-[#C9A84C]/40"
                        style={{ background: "#1e2736", border: "1px solid #30373f" }}
                      >
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold"
                          style={{ background: "#C9A84C1a", color: "#C9A84C" }}
                        >
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#e6edf3] truncate">{p.name}</div>
                          <div className="text-xs text-[#8b949e] mt-0.5">
                            Started {format(p.startDate, "MMM d, yyyy")} · Budget $
                            {Number(p.budget).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              statusColors[p.status] ?? "bg-[#30373f] text-[#8b949e]"
                            }`}
                          >
                            {p.status}
                          </span>
                          {p.estimates.length > 0 && (
                            <Link
                              href={`/${params.companyId}/${p.id}/estimates`}
                              className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors hover:text-[#C9A84C]"
                              style={{
                                color: "#8b949e",
                                border: "1px solid #30373f",
                              }}
                            >
                              {p.estimates.length} estimate{p.estimates.length !== 1 ? "s" : ""}
                            </Link>
                          )}
                          <Link
                            href={`/${params.companyId}/${p.id}/dashboard`}
                            className="text-sm text-[#8b949e] hover:text-[#C9A84C] transition-colors"
                          >
                            Open →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ───── Estimates tab ───── */}
          {activeTab === "estimates" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-[#e6edf3] tracking-tight">
                  Estimates &amp; Templates
                </h1>
                <p className="text-[#8b949e] mt-2 text-sm">
                  Select a category to open or create a template
                </p>
              </div>

              {/* Category cards 2x2 */}
              <div className="grid grid-cols-2 gap-5">
                {estimateCategories.map((cat) => {
                  const existing = templateByName(cat.name);

                  if (cat.comingSoon) {
                    return (
                      <div
                        key={cat.name}
                        className="rounded-2xl p-6 opacity-50"
                        style={{ background: "#1e2736", border: "1px solid #30373f" }}
                      >
                        <div
                          className="text-3xl mb-4"
                          style={{ filter: "grayscale(1)" }}
                        >
                          {cat.icon}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-[#e6edf3] text-lg">{cat.name}</span>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                            style={{
                              background: "#C9A84C22",
                              color: "#C9A84C",
                              border: "1px solid #C9A84C44",
                            }}
                          >
                            Coming Soon
                          </span>
                        </div>
                        <p className="text-[#8b949e] text-sm">{cat.desc}</p>
                      </div>
                    );
                  }

                  if (existing) {
                    return (
                      <Link
                        key={cat.name}
                        href={`/${params.companyId}/estimates/${existing.id}`}
                        className="group block rounded-2xl p-6 transition-all duration-200"
                        style={{ background: "#1e2736", border: "1px solid #30373f" }}
                      >
                        <div
                          className="text-3xl mb-4"
                          style={{ color: "#C9A84C" }}
                        >
                          {cat.icon}
                        </div>
                        <div className="font-bold text-[#e6edf3] text-lg group-hover:text-[#C9A84C] transition-colors mb-1">
                          {cat.name}
                        </div>
                        <p className="text-[#8b949e] text-sm mb-3">{cat.desc}</p>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "#C9A84C" }}
                        >
                          Open template →
                        </span>
                      </Link>
                    );
                  }

                  // No template yet — show create form
                  return (
                    <div
                      key={cat.name}
                      className="rounded-2xl p-6 transition-all duration-200 hover:border-[#C9A84C]/40"
                      style={{ background: "#1e2736", border: "1px solid #30373f" }}
                    >
                      <div className="text-3xl mb-4" style={{ color: "#C9A84C" }}>
                        {cat.icon}
                      </div>
                      <div className="font-bold text-[#e6edf3] text-lg mb-1">{cat.name}</div>
                      <p className="text-[#8b949e] text-sm mb-4">{cat.desc}</p>
                      <form action={createTemplateByName.bind(null, cat.name)}>
                        <button
                          type="submit"
                          className="text-xs font-semibold px-4 py-2 rounded-lg transition-all"
                          style={{
                            background: "#C9A84C22",
                            color: "#C9A84C",
                            border: "1px solid #C9A84C55",
                          }}
                        >
                          + Create Template
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>

              {/* Footer links */}
              <div className="flex gap-6 pt-2">
                <Link
                  href={`/${params.companyId}/estimates`}
                  className="text-sm text-[#8b949e] hover:text-[#C9A84C] transition-colors"
                >
                  View all templates →
                </Link>
                <Link
                  href={`/${params.companyId}/clients`}
                  className="text-sm text-[#8b949e] hover:text-[#C9A84C] transition-colors"
                >
                  View all client estimates →
                </Link>
              </div>
            </div>
          )}

          {/* ───── Calendar tab ───── */}
          {activeTab === "calendar" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-[#e6edf3] tracking-tight">Calendar</h1>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid #30373f" }}
              >
                <iframe
                  src="https://calendar.google.com/calendar/embed?src=mikebaruh%40gmail.com&ctz=America%2FNew_York&bgcolor=%230d1117&color=%23C9A84C"
                  width="100%"
                  height="600"
                  style={{ border: 0, display: "block" }}
                  title="Google Calendar"
                />
              </div>
              <p className="text-xs text-[#8b949e]">
                Connected to mikebaruh@gmail.com — make sure your calendar is set to public for the
                embed to display.
              </p>
            </div>
          )}

          {/* ───── Memory tab ───── */}
          {activeTab === "memory" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-[#e6edf3] tracking-tight">Memory</h1>

              {/* Info card */}
              <div
                className="rounded-2xl p-6"
                style={{ background: "#1e2736", border: "1px solid #30373f" }}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">🧠</span>
                  <div>
                    <div className="font-semibold text-[#e6edf3] mb-1">Daily Summaries</div>
                    <p className="text-sm text-[#8b949e]">
                      Daily memory summaries will be auto-generated at 9pm each day. This feature is
                      coming soon — your project context and key decisions will be captured
                      automatically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Memory files */}
              <div>
                <h2 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3">
                  Memory Files
                </h2>
                <div className="space-y-2">
                  {["MEMORY.md"].map((filename) => (
                    <div
                      key={filename}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: "#1e2736", border: "1px solid #30373f" }}
                    >
                      <span className="text-lg">📄</span>
                      <span className="text-sm font-mono text-[#e6edf3]">{filename}</span>
                      <span className="ml-auto text-xs text-[#8b949e]">.claude/projects memory</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

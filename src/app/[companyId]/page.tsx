import { redirect } from "next/navigation";

export default async function HubPage({
  params,
  searchParams,
}: {
  params: { companyId: string };
  searchParams?: { tab?: string };
}) {
  const tab = searchParams?.tab;

  if (tab === "calendar") {
    return (
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Calendar</h1>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <iframe
            src="https://calendar.google.com/calendar/embed?src=mikebaruh%40gmail.com&ctz=America%2FNew_York&bgcolor=%230d1117&color=%23C9A84C"
            width="100%"
            height="640"
            style={{ border: 0, display: "block" }}
            title="Google Calendar"
          />
        </div>
        <p className="text-xs" style={{ color: "#8b949e" }}>
          Connected to mikebaruh@gmail.com — calendar must be set to <strong>public</strong> in Google Calendar settings for the embed to display.{" "}
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#C9A84C", textDecoration: "underline" }}
          >
            Open in Google Calendar →
          </a>
        </p>
      </div>
    );
  }

  if (tab === "memory") {
    return (
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Memory</h1>
        <div className="rounded-2xl p-6" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">🧠</span>
            <div>
              <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Daily Summaries</div>
              <p className="text-sm" style={{ color: "#8b949e" }}>
                Daily memory summaries will be auto-generated at 9pm each day. This feature is
                coming soon — your project context and key decisions will be captured automatically.
              </p>
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8b949e" }}>Memory Files</h2>
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
            <span className="text-lg">📄</span>
            <span className="text-sm font-mono" style={{ color: "#e6edf3" }}>MEMORY.md</span>
            <span className="ml-auto text-xs" style={{ color: "#8b949e" }}>.claude/projects memory</span>
          </div>
        </div>
      </div>
    );
  }

  // Default: go to projects
  redirect(`/${params.companyId}/projects`);
}

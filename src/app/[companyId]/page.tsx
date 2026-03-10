import { redirect } from "next/navigation";
import { getDailySummaries } from "@/lib/daily-summary";

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
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Calendar</h1>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <iframe
            src="https://calendar.google.com/calendar/embed?src=mikebaruh%40gmail.com&ctz=America%2FNew_York&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&mode=MONTH"
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
    const summaries = await getDailySummaries(params.companyId);
    const todayUTC = new Date().toISOString().split("T")[0];

    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Memory</h1>

        {/* Info banner */}
        <div className="rounded-2xl p-5" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">🧠</span>
            <div>
              <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Daily Summaries</div>
              <p className="text-sm" style={{ color: "#8b949e" }}>
                Auto-generated at 9 PM ET each day by Claude. Covers expenses, task progress,
                journal entries, and new estimates across all projects.
              </p>
            </div>
          </div>
        </div>

        {/* Summary list */}
        {summaries.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
            <p className="text-sm" style={{ color: "#8b949e" }}>
              No summaries yet. The first one will appear tonight at 9 PM ET.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((s) => {
              const dateLabel = new Date(s.date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              });
              const isToday = s.date.toISOString().split("T")[0] === todayUTC;

              return (
                <div
                  key={s.id}
                  className="rounded-2xl p-5"
                  style={{ background: "#1e2736", border: "1px solid #30373f" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span>📅</span>
                    <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                      {dateLabel}
                    </span>
                    {isToday && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}
                      >
                        Today
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#8b949e" }}>
                    {s.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Default: go to projects
  redirect(`/${params.companyId}/projects`);
}

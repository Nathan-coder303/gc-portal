"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Today",     icon: "✅", path: (c: string) => `/${c}/today` },
  { label: "Projects",  icon: "📋", path: (c: string) => `/${c}/projects` },
  { label: "Clients",   icon: "👤", path: (c: string) => `/${c}/clients` },
  { label: "Subs",      icon: "🔧", path: (c: string) => `/${c}/subs` },
  { label: "Estimates", icon: "📊", path: (c: string) => `/${c}/estimates` },
  { label: "Sales",     icon: "🎯", path: (c: string) => `/${c}/leads` },
  { label: "Marketing", icon: "📣", path: (c: string) => `/${c}/marketing` },
  { label: "Calendar",  icon: "📅", path: (c: string) => `/${c}?tab=calendar` },
];

export default function MobileFooterNav({ companyId }: { companyId: string }) {
  const pathname = usePathname();

  function isActive(tab: typeof TABS[number]) {
    const href = tab.path(companyId);
    if (tab.label === "Today") return pathname.startsWith(`/${companyId}/today`);
    if (tab.label === "Calendar") return pathname === `/${companyId}` && (typeof window !== "undefined" && window.location.search.includes("tab=calendar"));
    return pathname.startsWith(href.split("?")[0]);
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 overflow-x-auto"
      style={{ background: "#161b22", borderTop: "1px solid #30373f" }}
    >
      <div className="flex items-center min-w-max px-2">
        {TABS.map(tab => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.label}
              href={tab.path(companyId)}
              className="flex flex-col items-center gap-0.5 px-4 py-2.5 min-w-[64px] transition-colors"
              style={{ color: active ? "#C9A84C" : "#8b949e" }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
              <span className="text-[10px] font-medium whitespace-nowrap"
                style={{ color: active ? "#C9A84C" : "#8b949e" }}>
                {tab.label}
              </span>
              {active && (
                <span className="w-1 h-1 rounded-full" style={{ background: "#C9A84C" }} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

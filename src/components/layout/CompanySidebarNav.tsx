"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { label: "Projects",  icon: "📋", href: (c: string) => `/${c}/projects` },
  { label: "Estimates", icon: "📊", href: (c: string) => `/${c}/estimates` },
  { label: "Clients",   icon: "👤", href: (c: string) => `/${c}/clients` },
  { label: "Calendar",  icon: "📅", href: (c: string) => `/${c}?tab=calendar` },
  { label: "Memory",    icon: "🧠", href: (c: string) => `/${c}?tab=memory` },
];

const SOON = [
  { label: "Discord", icon: "💬" },
  { label: "Telegram", icon: "✈️" },
  { label: "Teams", icon: "👥" },
];

function isActive(label: string, pathname: string, companyId: string, tab: string | null) {
  if (label === "Projects") {
    return pathname.startsWith(`/${companyId}/projects`) ||
      (pathname === `/${companyId}` && (!tab || tab === "projects"));
  }
  if (label === "Estimates") return pathname.startsWith(`/${companyId}/estimates`);
  if (label === "Clients") return pathname.startsWith(`/${companyId}/clients`);
  if (label === "Calendar") return pathname === `/${companyId}` && tab === "calendar";
  if (label === "Memory") return pathname === `/${companyId}` && tab === "memory";
  return false;
}

export default function CompanySidebarNav({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav className="flex-1 px-3 pt-2 space-y-1">
      {NAV.map(({ label, icon, href }) => {
        const active = isActive(label, pathname, companyId, tab);
        return (
          <Link
            key={label}
            href={href(companyId)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={
              active
                ? { background: "#C9A84C", color: "#0d1117" }
                : { color: "#8b949e" }
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </Link>
        );
      })}

      <div className="pt-2 pb-1">
        <div className="text-[10px] uppercase tracking-widest px-3 pb-1 font-bold" style={{ color: "#30373f" }}>
          Coming Soon
        </div>
        {SOON.map(({ label, icon }) => (
          <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm opacity-40 cursor-not-allowed">
            <span className="text-base leading-none">{icon}</span>
            <span style={{ color: "#8b949e" }}>{label}</span>
            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
              Soon
            </span>
          </div>
        ))}
      </div>
    </nav>
  );
}

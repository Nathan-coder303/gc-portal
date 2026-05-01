"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ALL_TABS = [
  { label: "Dashboard",   segment: "dashboard" },
  { label: "Subs Bids",  segment: "subs-bids" },
  { label: "Client Bid", segment: "client-bid" },
  { label: "Estimate",   segment: "estimates" },
  { label: "Expenses",   segment: "expenses" },
  { label: "Schedule",   segment: "schedule" },
  { label: "Ledger",     segment: "ledger" },
  { label: "Projections",segment: "projections" },
  { label: "Reports",    segment: "reports" },
  { label: "Settings",   segment: "settings" },
  { label: "Audit",      segment: "audit", adminOnly: true },
];

// PARTNER role: only ledger and schedule
const PARTNER_TABS = [
  { label: "Schedule", segment: "schedule" },
  { label: "Ledger",   segment: "ledger" },
];

export default function TabNav({
  companyId,
  projectId,
  role = "PM",
}: {
  companyId: string;
  projectId: string;
  role?: string;
}) {
  const pathname = usePathname();
  const base = `/${companyId}/${projectId}`;
  const isAdmin = role === "ADMIN";
  const isPartner = role === "PARTNER";
  const tabs = isPartner
    ? PARTNER_TABS
    : ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="w-full px-2 flex gap-1 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const href = `${base}/${tab.segment}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={tab.segment}
            href={href}
            className="px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
            style={
              active
                ? { borderColor: "#C9A84C", color: "#C9A84C" }
                : { borderColor: "transparent", color: "#8b949e" }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

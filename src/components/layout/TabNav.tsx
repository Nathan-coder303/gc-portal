"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Dashboard", segment: "dashboard" },
  { label: "Subs Bids", segment: "subs-bids" },
  { label: "Client Bid", segment: "client-bid" },
  { label: "Expenses", segment: "expenses" },
  { label: "Schedule", segment: "schedule" },
  { label: "Ledger", segment: "ledger" },
  { label: "Projections", segment: "projections" },
  { label: "Reports", segment: "reports" },
  { label: "Settings", segment: "settings" },
];

const ADMIN_TABS = [
  ...TABS,
  { label: "Audit", segment: "audit" },
];

export default function TabNav({
  companyId,
  projectId,
  isAdmin = false,
}: {
  companyId: string;
  projectId: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const base = `/${companyId}/${projectId}`;
  const tabs = isAdmin ? ADMIN_TABS : TABS;

  return (
    <nav className="max-w-7xl mx-auto px-2 flex gap-1 overflow-x-auto scrollbar-hide">
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

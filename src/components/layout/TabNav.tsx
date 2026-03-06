"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Dashboard", segment: "dashboard" },
  { label: "Expenses", segment: "expenses" },
  { label: "Schedule", segment: "schedule" },
  { label: "Ledger", segment: "ledger" },
  { label: "Reports", segment: "reports" },
  { label: "Settings", segment: "settings" },
];

export default function TabNav({ companyId, projectId }: { companyId: string; projectId: string }) {
  const pathname = usePathname();
  const base = `/${companyId}/${projectId}`;

  return (
    <nav className="max-w-7xl mx-auto px-4 flex gap-1">
      {tabs.map((tab) => {
        const href = `${base}/${tab.segment}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={tab.segment}
            href={href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

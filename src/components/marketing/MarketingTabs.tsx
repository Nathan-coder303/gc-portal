"use client";

import Link from "next/link";
import AgenciesTab from "./AgenciesTab";

const GOLD = "#C9A84C";

const TABS = [
  { key: "agencies", label: "Agencies" },
];

export default function MarketingTabs({ companyId, activeTab }: { companyId: string; activeTab: string }) {
  return (
    <>
      <div className="-mx-4 md:-mx-8" style={{ borderBottom: "1px solid #21262d" }}>
        <div className="flex overflow-x-auto px-4 md:px-8">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`?tab=${tab.key}`}
                className="px-4 py-3 text-sm font-semibold whitespace-nowrap relative shrink-0"
                style={{
                  color: isActive ? GOLD : "#8b949e",
                  borderBottom: isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        {activeTab === "agencies" && <AgenciesTab companyId={companyId} />}
      </div>
    </>
  );
}

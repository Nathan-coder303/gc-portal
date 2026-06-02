"use client";

import { useState } from "react";

type TabKey = "messages" | "photos" | "logs" | "documents";

const TAB_LABELS: Record<TabKey, string> = {
  messages: "Messages",
  photos: "Site Photos",
  logs: "Daily Logs",
  documents: "Documents",
};

export default function PortalTabContainer({
  tabs,
  children,
}: {
  tabs: TabKey[];
  children: Partial<Record<TabKey, React.ReactNode>>;
}) {
  const [active, setActive] = useState<TabKey>(tabs[0] ?? "messages");

  if (tabs.length === 0) return null;

  return (
    <div>
      {/* Tab bar */}
      <div
        className="sticky top-0 z-10 flex gap-1 px-4 pt-3 pb-0 overflow-x-auto"
        style={{ background: "#0d1117", borderBottom: "1px solid #30373f" }}
      >
        {tabs.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors"
              style={{
                color: isActive ? "#C9A84C" : "#8b949e",
                borderBottom: isActive ? "2px solid #C9A84C" : "2px solid transparent",
                background: "none",
                marginBottom: -1,
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {tabs.map((tab) => (
          <div key={tab} style={{ display: tab === active ? "block" : "none" }}>
            {children[tab]}
          </div>
        ))}
        <div className="text-center text-xs pt-10 pb-4" style={{ color: "#30373f" }}>
          MIBH Construction · Client Portal · Questions? Call 305-746-7307
        </div>
      </div>
    </div>
  );
}

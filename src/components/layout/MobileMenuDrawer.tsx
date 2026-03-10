"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { label: "Projects",  icon: "📋", href: (c: string) => `/${c}/projects` },
  { label: "Estimates", icon: "📊", href: (c: string) => `/${c}/estimates` },
  { label: "Clients",   icon: "👤", href: (c: string) => `/${c}/clients` },
  { label: "Marketing", icon: "📣", href: (c: string) => `/${c}/marketing` },
  { label: "Calendar",  icon: "📅", href: (c: string) => `/${c}?tab=calendar` },
  { label: "Memory",    icon: "🧠", href: (c: string) => `/${c}?tab=memory` },
];

function isActive(label: string, pathname: string, companyId: string, tab: string | null) {
  if (label === "Projects") return pathname.startsWith(`/${companyId}/projects`) || (pathname === `/${companyId}` && (!tab || tab === "projects"));
  if (label === "Estimates") return pathname.startsWith(`/${companyId}/estimates`);
  if (label === "Clients") return pathname.startsWith(`/${companyId}/clients`);
  if (label === "Marketing") return pathname.startsWith(`/${companyId}/marketing`);
  if (label === "Calendar") return pathname === `/${companyId}` && tab === "calendar";
  if (label === "Memory") return pathname === `/${companyId}` && tab === "memory";
  return false;
}

export default function MobileMenuDrawer({
  companyId,
  companyName,
  userName,
  userRole,
  signOutAction,
}: {
  companyId: string;
  companyName: string;
  userName: string;
  userRole: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg"
        style={{ color: "#e6edf3" }}
        aria-label="Open menu"
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={() => setOpen(false)}
        >
          {/* Drawer */}
          <div
            className="w-64 h-full flex flex-col"
            style={{ background: "#161b22", borderRight: "1px solid #30373f" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3">
              <span className="text-sm font-semibold" style={{ color: "#C9A84C" }}>{companyName}</span>
              <button onClick={() => setOpen(false)} style={{ color: "#8b949e" }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
              {NAV.map(({ label, icon, href }) => {
                const active = isActive(label, pathname, companyId, tab);
                return (
                  <Link
                    key={label}
                    href={href(companyId)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium"
                    style={active ? { background: "#C9A84C", color: "#0d1117" } : { color: "#8b949e" }}
                  >
                    <span className="text-base">{icon}</span>
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div className="px-4 pb-6 pt-4" style={{ borderTop: "1px solid #30373f" }}>
              <div className="text-sm font-medium truncate mb-1" style={{ color: "#e6edf3" }}>{userName}</div>
              <span
                className="inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-3"
                style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}
              >
                {userRole}
              </span>
              <form action={signOutAction}>
                <button className="text-xs" style={{ color: "#8b949e" }}>Sign out →</button>
              </form>
            </div>
          </div>

          {/* Dark overlay on the right */}
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.6)" }} />
        </div>
      )}
    </>
  );
}

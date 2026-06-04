"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DashboardIcon, ProjectsIcon, SubsIcon, EstimatesIcon, ClientsIcon,
  SalesIcon, MarketingIcon, CalendarIcon, MemoryIcon, TeamsIcon,
} from "./NavIcons";

type NavEntry = {
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  href: (c: string) => string;
};

const ACTIVE_COLOR = "#0d1117";
const IDLE_COLOR = "#8b949e";

const NAV: NavEntry[] = [
  { label: "Dashboard", icon: <DashboardIcon color={IDLE_COLOR} />,  activeIcon: <DashboardIcon color={ACTIVE_COLOR} />,  href: (c) => `/${c}/today` },
  { label: "Projects",  icon: <ProjectsIcon color={IDLE_COLOR} />,   activeIcon: <ProjectsIcon color={ACTIVE_COLOR} />,   href: (c) => `/${c}/projects` },
  { label: "Subs",      icon: <SubsIcon color={IDLE_COLOR} />,       activeIcon: <SubsIcon color={ACTIVE_COLOR} />,       href: (c) => `/${c}/subs` },
  { label: "Estimates", icon: <EstimatesIcon color={IDLE_COLOR} />,  activeIcon: <EstimatesIcon color={ACTIVE_COLOR} />,  href: (c) => `/${c}/estimates` },
  { label: "Clients",   icon: <ClientsIcon color={IDLE_COLOR} />,    activeIcon: <ClientsIcon color={ACTIVE_COLOR} />,    href: (c) => `/${c}/clients` },
  { label: "Sales",     icon: <SalesIcon color={IDLE_COLOR} />,      activeIcon: <SalesIcon color={ACTIVE_COLOR} />,      href: (c) => `/${c}/leads` },
  { label: "Marketing", icon: <MarketingIcon color={IDLE_COLOR} />,  activeIcon: <MarketingIcon color={ACTIVE_COLOR} />,  href: (c) => `/${c}/marketing` },
  { label: "Calendar",  icon: <CalendarIcon color={IDLE_COLOR} />,   activeIcon: <CalendarIcon color={ACTIVE_COLOR} />,   href: (c) => `/${c}?tab=calendar` },
  { label: "Memory",    icon: <MemoryIcon color={IDLE_COLOR} />,     activeIcon: <MemoryIcon color={ACTIVE_COLOR} />,     href: (c) => `/${c}?tab=memory` },
];

function isActive(label: string, pathname: string, companyId: string, tab: string | null) {
  if (label === "Dashboard") return pathname.startsWith(`/${companyId}/today`);
  if (label === "Projects") {
    return pathname.startsWith(`/${companyId}/projects`) ||
      (pathname === `/${companyId}` && (!tab || tab === "projects"));
  }
  if (label === "Subs") return pathname.startsWith(`/${companyId}/subs`);
  if (label === "Estimates") return pathname.startsWith(`/${companyId}/estimates`);
  if (label === "Clients") return pathname.startsWith(`/${companyId}/clients`);
  if (label === "Sales") return pathname.startsWith(`/${companyId}/leads`);
  if (label === "Marketing") return pathname.startsWith(`/${companyId}/marketing`);
  if (label === "Calendar") return pathname === `/${companyId}` && tab === "calendar";
  if (label === "Memory") return pathname === `/${companyId}` && tab === "memory";
  return false;
}

export default function CompanySidebarNav({ companyId, role }: { companyId: string; role?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const isPartner = role === "PARTNER";
  const visibleNav = isPartner ? NAV.filter((n) => n.label === "Projects") : NAV;

  return (
    <nav className="flex-1 px-3 pt-2 space-y-1">
      {visibleNav.map(({ label, icon, activeIcon, href }) => {
        const active = isActive(label, pathname, companyId, tab);
        return (
          <Link
            key={label}
            href={href(companyId)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={active ? { background: "#C9A84C", color: "#0d1117" } : { color: IDLE_COLOR }}
          >
            <span className="shrink-0">{active ? activeIcon : icon}</span>
            {label}
          </Link>
        );
      })}

      {!isPartner && (
        <Link
          href={`/${companyId}/settings`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={pathname.startsWith(`/${companyId}/settings`) ? { background: "#C9A84C", color: "#0d1117" } : { color: IDLE_COLOR }}
        >
          <span className="shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          Settings
        </Link>
      )}

      {!isPartner && (
        <Link
          href={`/${companyId}/team`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={pathname.startsWith(`/${companyId}/team`) ? { background: "#C9A84C", color: "#0d1117" } : { color: IDLE_COLOR }}
        >
          <span className="shrink-0">
            <TeamsIcon color={pathname.startsWith(`/${companyId}/team`) ? "#0d1117" : IDLE_COLOR} />
          </span>
          Team
        </Link>
      )}
    </nav>
  );
}

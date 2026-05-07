"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon, ProjectsIcon, SubsIcon, EstimatesIcon, ClientsIcon,
  SalesIcon, MarketingIcon, CalendarIcon, MemoryIcon,
} from "./NavIcons";

const GOLD = "#C9A84C";
const IDLE = "#8b949e";

const TABS = [
  { label: "Today",     icon: DashboardIcon,  path: (c: string) => `/${c}/today` },
  { label: "Projects",  icon: ProjectsIcon,   path: (c: string) => `/${c}/projects` },
  { label: "Clients",   icon: ClientsIcon,    path: (c: string) => `/${c}/clients` },
  { label: "Subs",      icon: SubsIcon,       path: (c: string) => `/${c}/subs` },
  { label: "Estimates", icon: EstimatesIcon,  path: (c: string) => `/${c}/estimates` },
  { label: "Sales",     icon: SalesIcon,      path: (c: string) => `/${c}/leads` },
  { label: "Marketing", icon: MarketingIcon,  path: (c: string) => `/${c}/marketing` },
  { label: "Calendar",  icon: CalendarIcon,   path: (c: string) => `/${c}?tab=calendar` },
  { label: "Memory",    icon: MemoryIcon,     path: (c: string) => `/${c}?tab=memory` },
];

function tabIsActive(label: string, pathname: string, companyId: string) {
  if (label === "Today") return pathname.startsWith(`/${companyId}/today`);
  if (label === "Projects") return pathname.startsWith(`/${companyId}/projects`);
  if (label === "Clients") return pathname.startsWith(`/${companyId}/clients`);
  if (label === "Subs") return pathname.startsWith(`/${companyId}/subs`);
  if (label === "Estimates") return pathname.startsWith(`/${companyId}/estimates`);
  if (label === "Sales") return pathname.startsWith(`/${companyId}/leads`);
  if (label === "Marketing") return pathname.startsWith(`/${companyId}/marketing`);
  return false;
}

export default function MobileFooterNav({ companyId }: { companyId: string }) {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 overflow-x-auto scrollbar-none"
      style={{ background: "#161b22", borderTop: "1px solid #30373f" }}
    >
      <div className="flex items-center min-w-max">
        {TABS.map(({ label, icon: Icon, path }) => {
          const active = tabIsActive(label, pathname, companyId);
          const color = active ? GOLD : IDLE;
          return (
            <Link
              key={label}
              href={path(companyId)}
              className="flex flex-col items-center gap-1 px-4 py-2 min-w-[64px]"
              style={{ color }}
            >
              <Icon size={22} color={color} />
              <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
              {active && <span className="w-1 h-1 rounded-full" style={{ background: GOLD }} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

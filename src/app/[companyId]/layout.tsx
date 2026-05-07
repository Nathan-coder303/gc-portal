import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import CompanySidebarNav from "@/components/layout/CompanySidebarNav";
import MobileMenuDrawer from "@/components/layout/MobileMenuDrawer";
import MobileFooterNav from "@/components/layout/MobileFooterNav";
import { UndoRedoProvider } from "@/lib/undo-redo-context";
import UndoRedoBar from "@/components/layout/UndoRedoBar";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const company = await prisma.company.findUnique({ where: { id: params.companyId } });
  const companyName = company?.name ?? "GC Portal";

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <UndoRedoProvider>
    <div className="flex min-h-screen" style={{ background: "#0d1117" }}>

      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <aside
        className="hidden md:flex w-56 flex-shrink-0 flex-col sticky top-0 h-screen overflow-y-auto"
        style={{ background: "#161b22", borderRight: "1px solid #30373f" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          <Link href={`/${params.companyId}`}>
            <div
              className="rounded-xl overflow-hidden mb-3"
              style={{ border: "1.5px solid #C9A84C44", padding: "3px", background: "#1e2736" }}
            >
              <Image src="/logo.png" alt="MIBH Logo" width={70} height={70} className="rounded-lg object-contain" />
            </div>
          </Link>
          <span className="text-xs font-semibold tracking-wide" style={{ color: "#C9A84C" }}>
            {companyName}
          </span>
        </div>

        <Suspense fallback={<div className="flex-1" />}>
          <CompanySidebarNav companyId={params.companyId} role={session.user.role} />
        </Suspense>

        <div className="px-3 pb-5 pt-4" style={{ borderTop: "1px solid #30373f" }}>
          <div className="flex flex-col gap-2">
            <div>
              <div className="text-sm font-medium truncate" style={{ color: "#e6edf3" }}>
                {session.user.name}
              </div>
              <span
                className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}
              >
                {session.user.role}
              </span>
            </div>
            <form action={handleSignOut}>
              <button className="text-xs transition-colors mt-1" style={{ color: "#8b949e" }}>
                Sign out →
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar (hidden on desktop) ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
        <Suspense fallback={null}>
          <MobileMenuDrawer
            companyId={params.companyId}
            companyName={companyName}
            userName={session.user.name ?? ""}
            userRole={session.user.role}
            signOutAction={handleSignOut}
          />
        </Suspense>
        <Link href={`/${params.companyId}/projects`}>
          <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>{companyName}</span>
        </Link>
        <Suspense fallback={<div className="w-[68px]" />}>
          <UndoRedoBar />
        </Suspense>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 md:pt-0 pt-14 md:pb-0 pb-16">
        {/* Desktop undo/redo bar */}
        <div className="hidden md:flex items-center gap-2 px-6 py-2 border-b" style={{ borderColor: "#30373f" }}>
          <span className="text-xs" style={{ color: "#8b949e" }}>History</span>
          <UndoRedoBar />
        </div>
        {children}
      </main>

      {/* ── Mobile footer tab bar ── */}
      <MobileFooterNav companyId={params.companyId} />
    </div>
    </UndoRedoProvider>
  );
}

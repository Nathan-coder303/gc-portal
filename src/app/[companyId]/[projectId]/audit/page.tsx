import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { AuditAction, EntityType, Prisma } from "@prisma/client";

const CARD = { background: "#1e2736", border: "1px solid #30373f" } as const;

const ACTION_STYLES: Record<AuditAction, { background: string; color: string }> = {
  CREATE:  { background: "#0d2a1a", color: "#4ade80" },
  UPDATE:  { background: "#1a2240", color: "#93c5fd" },
  DELETE:  { background: "#2d1b1b", color: "#fca5a5" },
  ARCHIVE: { background: "#2d2410", color: "#fcd34d" },
  RESTORE: { background: "#1e1a40", color: "#c4b5fd" },
  IMPORT:  { background: "#0d2a2a", color: "#67e8f9" },
  REVERSE: { background: "#2d1a0d", color: "#fdba74" },
};

const INPUT_STYLE = "w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2" as const;

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: { companyId: string; projectId: string };
  searchParams: {
    entityType?: string;
    action?: string;
    user?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect(`/${params.companyId}/${params.projectId}/dashboard`);

  const where: Prisma.AuditLogWhereInput = { projectId: params.projectId };
  if (searchParams.entityType) where.entityType = searchParams.entityType as EntityType;
  if (searchParams.action) where.action = searchParams.action as AuditAction;
  if (searchParams.user) where.userName = { contains: searchParams.user, mode: "insensitive" };
  if (searchParams.from) where.createdAt = { ...((where.createdAt as object) ?? {}), gte: new Date(searchParams.from) };
  if (searchParams.to) where.createdAt = { ...((where.createdAt as object) ?? {}), lte: new Date(searchParams.to + "T23:59:59") };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  const entityTypes = Object.values(EntityType);
  const actions = Object.values(AuditAction);

  const inputStyle = {
    ...CARD,
    color: "#e6edf3",
    outline: "none",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Audit Log</h1>
        <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
          Immutable record of all changes — {logs.length} entries shown
        </p>
      </div>

      {/* Filters */}
      <form method="GET" className="rounded-xl p-4 mb-6" style={CARD}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Entity Type</label>
            <select name="entityType" defaultValue={searchParams.entityType ?? ""}
              className={INPUT_STYLE} style={inputStyle}>
              <option value="">All types</option>
              {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Action</label>
            <select name="action" defaultValue={searchParams.action ?? ""}
              className={INPUT_STYLE} style={inputStyle}>
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>User</label>
            <input type="text" name="user" defaultValue={searchParams.user ?? ""}
              placeholder="Search name..."
              className={INPUT_STYLE} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>From</label>
            <input type="date" name="from" defaultValue={searchParams.from ?? ""}
              className={INPUT_STYLE} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>To</label>
            <input type="date" name="to" defaultValue={searchParams.to ?? ""}
              className={INPUT_STYLE} style={inputStyle} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit"
            className="px-4 py-1.5 text-sm rounded-lg font-medium"
            style={{ background: "#C9A84C", color: "#0d1117" }}>
            Filter
          </button>
          <a href="?"
            className="px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ border: "1px solid #30373f", color: "#8b949e" }}>
            Clear
          </a>
        </div>
      </form>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={CARD}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
              <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "#8b949e" }}>Timestamp</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>User</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Action</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Entity</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>ID</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Changes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "#8b949e" }}>
                  No audit log entries match the current filters
                </td>
              </tr>
            )}
            {logs.map((log) => {
              let changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
              try { changes = JSON.parse(log.changes); } catch { /* empty */ }

              return (
                <tr key={log.id} className="align-top" style={{ borderBottom: "1px solid #30373f" }}>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: "#8b949e" }}>
                    {format(log.createdAt, "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium" style={{ color: "#e6edf3" }}>{log.userName}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded font-medium" style={ACTION_STYLES[log.action]}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "#8b949e" }}>{log.entityType}</td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#8b949e" }}>
                    {log.entityId === "bulk" ? "bulk" : log.entityId.slice(-8)}
                  </td>
                  <td className="px-4 py-2.5">
                    {changes.length > 0 ? (
                      <ul className="space-y-0.5">
                        {changes.map((c, i) => (
                          <li key={i} className="text-xs" style={{ color: "#8b949e" }}>
                            <span className="font-medium" style={{ color: "#e6edf3" }}>{c.field}:</span>{" "}
                            {c.oldValue != null && (
                              <span className="line-through mr-1" style={{ color: "#8b949e" }}>{c.oldValue}</span>
                            )}
                            <span style={{ color: "#e6edf3" }}>{c.newValue ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs" style={{ color: "#30373f" }}>—</span>
                    )}
                    {log.reason && (
                      <p className="text-xs mt-0.5" style={{ color: "#fcd34d" }}>Reason: {log.reason}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

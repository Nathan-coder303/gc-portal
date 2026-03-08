import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { AuditAction, EntityType, Prisma } from "@prisma/client";

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  ARCHIVE: "bg-amber-100 text-amber-700",
  RESTORE: "bg-purple-100 text-purple-700",
  IMPORT: "bg-cyan-100 text-cyan-700",
  REVERSE: "bg-orange-100 text-orange-700",
};

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

  const where: Prisma.AuditLogWhereInput = {
    projectId: params.projectId,
  };
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-0.5">Immutable record of all changes — {logs.length} entries shown</p>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Entity Type</label>
            <select name="entityType" defaultValue={searchParams.entityType ?? ""}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All types</option>
              {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action</label>
            <select name="action" defaultValue={searchParams.action ?? ""}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">User</label>
            <input type="text" name="user" defaultValue={searchParams.user ?? ""}
              placeholder="Search name..."
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input type="date" name="from" defaultValue={searchParams.from ?? ""}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input type="date" name="to" defaultValue={searchParams.to ?? ""}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit"
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
            Filter
          </button>
          <a href="?"
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Clear
          </a>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium whitespace-nowrap">Timestamp</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">User</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Action</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Entity</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">ID</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Changes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  No audit log entries match the current filters
                </td>
              </tr>
            )}
            {logs.map((log) => {
              let changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
              try { changes = JSON.parse(log.changes); } catch { /* empty */ }

              return (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 align-top">
                  <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                    {format(log.createdAt, "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 text-xs font-medium">{log.userName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_COLORS[log.action]}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{log.entityType}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-slate-400">
                    {log.entityId === "bulk" ? "bulk" : log.entityId.slice(-8)}
                  </td>
                  <td className="px-4 py-2.5">
                    {changes.length > 0 ? (
                      <ul className="space-y-0.5">
                        {changes.map((c, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            <span className="font-medium text-slate-700">{c.field}:</span>{" "}
                            {c.oldValue != null && (
                              <span className="line-through text-slate-400 mr-1">{c.oldValue}</span>
                            )}
                            <span className="text-slate-800">{c.newValue ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                    {log.reason && (
                      <p className="text-xs text-amber-600 mt-0.5">Reason: {log.reason}</p>
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

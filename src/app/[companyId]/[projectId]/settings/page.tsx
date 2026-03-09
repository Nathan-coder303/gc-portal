import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import CsvImportExpenses from "@/components/expenses/CsvImportExpenses";
import CsvImportSchedule from "@/components/schedule/CsvImportSchedule";
import CostCodeManager from "@/components/expenses/CostCodeManager";
import ProjectEditor from "@/components/settings/ProjectEditor";
import UserManager from "@/components/settings/UserManager";
import AccountManager from "@/components/settings/AccountManager";

const CARD = { background: "#1e2736", border: "1px solid #30373f" } as const;

export default async function SettingsPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  const role = session?.user.role ?? "PARTNER";
  const isAdmin = can(role, "project:edit");

  const [project, costCodes, users, accounts] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.costCode.findMany({ where: { projectId: params.projectId, archivedAt: null }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { companyId: params.companyId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { projectId: params.projectId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Settings & Imports</h1>
        <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>Manage project configuration and import data</p>
      </div>

      <div className="space-y-6">
        {/* Import Expenses CSV */}
        <div className="rounded-xl p-5" style={CARD}>
          <h2 className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Import Expenses CSV</h2>
          <p className="text-sm mb-4" style={{ color: "#8b949e" }}>
            Upload a CSV file with columns: date, vendor, description, cost_code, category, amount, tax, payment_method, paid_by, receipt_url
          </p>
          <div className="mb-3">
            <a
              href="/samples/sample-expenses.csv"
              download
              className="text-sm transition-colors"
              style={{ color: "#C9A84C" }}
            >
              Download sample CSV
            </a>
          </div>
          <CsvImportExpenses projectId={params.projectId} />
        </div>

        {/* Import Schedule CSV */}
        <div className="rounded-xl p-5" style={CARD}>
          <h2 className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Import Schedule CSV</h2>
          <p className="text-sm mb-4" style={{ color: "#8b949e" }}>
            Upload a CSV file with columns: phase, task_name, duration_days, predecessor_task, trade, milestone, default_assignee
          </p>
          <div className="mb-3">
            <a
              href="/samples/sample-schedule.csv"
              download
              className="text-sm transition-colors"
              style={{ color: "#C9A84C" }}
            >
              Download sample CSV
            </a>
          </div>
          <CsvImportSchedule projectId={params.projectId} />
        </div>

        {/* Cost Codes */}
        <div className="rounded-xl p-5" style={CARD}>
          <CostCodeManager
            projectId={params.projectId}
            costCodes={costCodes.map(cc => ({
              id: cc.id,
              code: cc.code,
              name: cc.name,
              budgetAmount: Number(cc.budgetAmount),
            }))}
          />
        </div>

        {/* Ledger Accounts */}
        <div className="rounded-xl p-5" style={CARD}>
          {isAdmin ? (
            <AccountManager
              accounts={accounts.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                isPartnerCapital: a.isPartnerCapital,
                projectId: a.projectId,
              }))}
            />
          ) : (
            <>
              <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>Ledger Accounts</h2>
              <table className="w-full text-sm">
                <thead style={{ borderBottom: "1px solid #30373f" }}>
                  <tr>
                    <th className="text-left py-2 font-medium" style={{ color: "#8b949e" }}>Account</th>
                    <th className="text-left py-2 font-medium" style={{ color: "#8b949e" }}>Type</th>
                    <th className="text-left py-2 font-medium" style={{ color: "#8b949e" }}>Partner Capital</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #30373f" }}>
                      <td className="py-2" style={{ color: "#e6edf3" }}>{a.name}</td>
                      <td className="py-2" style={{ color: "#8b949e" }}>{a.type}</td>
                      <td className="py-2" style={{ color: "#8b949e" }}>{a.isPartnerCapital ? "Yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Users */}
        <div className="rounded-xl p-5" style={CARD}>
          {isAdmin ? (
            <UserManager
              users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))}
              currentUserId={session?.user.id ?? ""}
            />
          ) : (
            <>
              <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>Users</h2>
              <table className="w-full text-sm">
                <thead style={{ borderBottom: "1px solid #30373f" }}>
                  <tr>
                    <th className="text-left py-2 font-medium" style={{ color: "#8b949e" }}>Name</th>
                    <th className="text-left py-2 font-medium" style={{ color: "#8b949e" }}>Email</th>
                    <th className="text-left py-2 font-medium" style={{ color: "#8b949e" }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #30373f" }}>
                      <td className="py-2 font-medium" style={{ color: "#e6edf3" }}>{u.name}</td>
                      <td className="py-2" style={{ color: "#8b949e" }}>{u.email}</td>
                      <td className="py-2">
                        <span className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Project Info */}
        <div className="rounded-xl p-5" style={CARD}>
          {isAdmin && project ? (
            <ProjectEditor
              project={{
                id: project.id,
                name: project.name,
                address: project.address,
                city: project.city,
                state: project.state,
                zip: project.zip,
                startDate: project.startDate.toISOString().split("T")[0],
                budget: Number(project.budget),
                status: project.status,
              }}
            />
          ) : (
            <>
              <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>Project Info</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt style={{ color: "#8b949e" }}>Project Name</dt>
                  <dd className="font-medium" style={{ color: "#e6edf3" }}>{project?.name}</dd>
                </div>
                <div className="col-span-2">
                  <dt style={{ color: "#8b949e" }}>Address</dt>
                  <dd className="font-medium" style={{ color: "#e6edf3" }}>
                    {project?.address ?? "—"}
                    {(project?.city || project?.state || project?.zip) && (
                      <span className="block">{[project?.city, project?.state, project?.zip].filter(Boolean).join(", ")}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "#8b949e" }}>Start Date</dt>
                  <dd className="font-medium" style={{ color: "#e6edf3" }}>
                    {project?.startDate.toLocaleDateString("en-US")}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "#8b949e" }}>Budget</dt>
                  <dd className="font-medium" style={{ color: "#e6edf3" }}>
                    ${Number(project?.budget).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "#8b949e" }}>Status</dt>
                  <dd className="font-medium" style={{ color: "#e6edf3" }}>{project?.status}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

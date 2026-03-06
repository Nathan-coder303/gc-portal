import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import CsvImportExpenses from "@/components/expenses/CsvImportExpenses";
import CsvImportSchedule from "@/components/schedule/CsvImportSchedule";
import CostCodeManager from "@/components/expenses/CostCodeManager";
import ProjectEditor from "@/components/settings/ProjectEditor";
import UserManager from "@/components/settings/UserManager";

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
    prisma.account.findMany({ where: { projectId: params.projectId } }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Settings & Imports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage project configuration and import data</p>
      </div>

      <div className="space-y-6">
        {/* Import Expenses CSV */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-1">Import Expenses CSV</h2>
          <p className="text-sm text-slate-500 mb-4">
            Upload a CSV file with columns: date, vendor, description, cost_code, category, amount, tax, payment_method, paid_by, receipt_url
          </p>
          <div className="mb-3">
            <a
              href="/samples/sample-expenses.csv"
              download
              className="text-sm text-blue-600 hover:underline"
            >
              Download sample CSV
            </a>
          </div>
          <CsvImportExpenses projectId={params.projectId} />
        </div>

        {/* Import Schedule CSV */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-1">Import Schedule CSV</h2>
          <p className="text-sm text-slate-500 mb-4">
            Upload a CSV file with columns: phase, task_name, duration_days, predecessor_task, trade, milestone, default_assignee
          </p>
          <div className="mb-3">
            <a
              href="/samples/sample-schedule.csv"
              download
              className="text-sm text-blue-600 hover:underline"
            >
              Download sample CSV
            </a>
          </div>
          <CsvImportSchedule projectId={params.projectId} />
        </div>

        {/* Cost Codes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
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
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Ledger Accounts</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="text-left py-2 text-slate-500 font-medium">Account</th>
                <th className="text-left py-2 text-slate-500 font-medium">Type</th>
                <th className="text-left py-2 text-slate-500 font-medium">Partner Capital</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{a.name}</td>
                  <td className="py-2 text-slate-500">{a.type}</td>
                  <td className="py-2 text-slate-500">{a.isPartnerCapital ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {isAdmin ? (
            <UserManager
              users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))}
              currentUserId={session?.user.id ?? ""}
            />
          ) : (
            <>
              <h2 className="font-semibold text-slate-800 mb-4">Users</h2>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2 text-slate-500 font-medium">Name</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Email</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-slate-800">{u.name}</td>
                      <td className="py-2 text-slate-500">{u.email}</td>
                      <td className="py-2">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{u.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Project Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {isAdmin && project ? (
            <ProjectEditor
              project={{
                id: project.id,
                name: project.name,
                code: project.code,
                startDate: project.startDate.toISOString().split("T")[0],
                budget: Number(project.budget),
                status: project.status,
              }}
            />
          ) : (
            <>
              <h2 className="font-semibold text-slate-800 mb-4">Project Info</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Project Name</dt>
                  <dd className="font-medium text-slate-800">{project?.name}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Code</dt>
                  <dd className="font-medium text-slate-800">{project?.code}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Start Date</dt>
                  <dd className="font-medium text-slate-800">
                    {project?.startDate.toLocaleDateString("en-US")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Budget</dt>
                  <dd className="font-medium text-slate-800">
                    ${Number(project?.budget).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium text-slate-800">{project?.status}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

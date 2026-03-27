"use client";

import { useState } from "react";
import { createUser, updateUserRole, archiveUser, updateUserLastName, setUserProjectAccess } from "@/app/[companyId]/[projectId]/settings/actions";
import { TrashIcon } from "@/components/ui/icons";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  lastName: string;
  allowedProjectIds: string[];
};

type Project = { id: string; name: string };

const ROLES = ["ADMIN", "PM", "BOOKKEEPER", "PARTNER"] as const;
const roleBadge: Record<string, string> = {
  ADMIN:      "bg-red-50 text-red-700",
  PM:         "bg-blue-50 text-blue-700",
  BOOKKEEPER: "bg-green-50 text-green-700",
  PARTNER:    "bg-violet-50 text-violet-700",
};

export default function UserManager({
  users,
  currentUserId,
  allProjects,
}: {
  users: User[];
  currentUserId: string;
  allProjects: Project[];
}) {
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState("");
  const [addError, setAddError] = useState("");
  const [localUsers, setLocalUsers] = useState(users);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLastName, setProfileLastName] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.lastName]))
  );
  const [profileProjects, setProfileProjects] = useState<Record<string, string[]>>(
    Object.fromEntries(users.map((u) => [u.id, u.allowedProjectIds]))
  );

  async function handleRoleChange(userId: string, role: string) {
    setLoadingId(userId);
    setError("");
    try {
      await updateUserRole(userId, role as "ADMIN" | "PM" | "BOOKKEEPER" | "PARTNER");
      setLocalUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleArchive(userId: string) {
    setLoadingId(userId);
    setError("");
    try {
      await archiveUser(userId);
      setLocalUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");
    const fd = new FormData(e.currentTarget);
    try {
      await createUser(fd);
      setAdding(false);
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleSaveProfile(userId: string) {
    setProfileSaving(true);
    try {
      await updateUserLastName(userId, profileLastName[userId] ?? "");
      await setUserProjectAccess(userId, profileProjects[userId] ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  function toggleProject(userId: string, projectId: string) {
    setProfileProjects((prev) => {
      const current = prev[userId] ?? [];
      return {
        ...prev,
        [userId]: current.includes(projectId)
          ? current.filter((id) => id !== projectId)
          : [...current, projectId],
      };
    });
  }

  const field = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Users</h2>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + Add User
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {adding && (
        <form onSubmit={handleAddUser} className="mb-4 p-4 bg-blue-50 rounded-lg grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input type="text" name="name" required placeholder="Full name" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" name="email" required placeholder="email@example.com" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select name="role" className={field}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input type="password" name="password" required minLength={8}
              placeholder="Min 8 characters" className={field} />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <button type="submit" disabled={addLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {addLoading ? "Creating..." : "Create User"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setAddError(""); }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            {addError && <span className="text-sm text-red-600">{addError}</span>}
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="text-left py-2 text-slate-500 font-medium">Name</th>
            <th className="text-left py-2 text-slate-500 font-medium">Email</th>
            <th className="text-left py-2 text-slate-500 font-medium">Role</th>
            <th className="py-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {localUsers.map((u) => (
            <>
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2.5 font-medium text-slate-800">{u.name}</td>
                <td className="py-2.5 text-slate-500">{u.email}</td>
                <td className="py-2.5">
                  <select
                    defaultValue={u.role}
                    disabled={loadingId === u.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded border-0 focus:outline-none cursor-pointer ${roleBadge[u.role] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="py-2.5 text-right flex gap-2 justify-end">
                  <button
                    onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    {expandedId === u.id ? "▲ Profile" : "▼ Profile"}
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => handleArchive(u.id)}
                      disabled={loadingId === u.id}
                      className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-50"
                      style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                      title="Archive"
                    >
                      <TrashIcon size={13} />
                    </button>
                  )}
                </td>
              </tr>
              {expandedId === u.id && (
                <tr key={`${u.id}-profile`} className="bg-slate-50">
                  <td colSpan={4} className="px-4 py-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Last Name (used for ledger access filtering)
                        </label>
                        <input
                          type="text"
                          value={profileLastName[u.id] ?? ""}
                          onChange={(e) => setProfileLastName((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          placeholder="e.g. Smith"
                          className="border border-slate-200 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2">
                          Project Access (leave unchecked = access to all projects)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {allProjects.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(profileProjects[u.id] ?? []).includes(p.id)}
                                onChange={() => toggleProject(u.id, p.id)}
                                className="rounded"
                              />
                              {p.name}
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          {(profileProjects[u.id] ?? []).length === 0
                            ? "No restrictions — user sees all projects"
                            : `Restricted to ${(profileProjects[u.id] ?? []).length} project(s)`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSaveProfile(u.id)}
                        disabled={profileSaving}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                      >
                        {profileSaving ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

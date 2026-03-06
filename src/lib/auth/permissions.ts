import { Session } from "next-auth";

export type Action =
  | "expense:create"
  | "expense:edit"
  | "expense:archive"
  | "expense:import"
  | "costCode:create"
  | "costCode:edit"
  | "costCode:archive"
  | "task:create"
  | "task:edit"
  | "task:archive"
  | "task:import"
  | "task:updateStatus"
  | "journalEntry:create"
  | "journalEntry:reverse"
  | "partner:create"
  | "partner:edit"
  | "partner:archive"
  | "account:create"
  | "account:archive"
  | "user:create"
  | "user:edit"
  | "user:archive"
  | "project:edit"
  | "settings:edit"
  | "auditLog:read";

type Role = "ADMIN" | "PM" | "BOOKKEEPER" | "PARTNER";

const matrix: Record<Action, Role[]> = {
  "expense:create":      ["ADMIN", "PM", "BOOKKEEPER"],
  "expense:edit":        ["ADMIN", "BOOKKEEPER"],
  "expense:archive":     ["ADMIN"],
  "expense:import":      ["ADMIN", "PM", "BOOKKEEPER"],
  "costCode:create":     ["ADMIN", "PM"],
  "costCode:edit":       ["ADMIN", "PM"],
  "costCode:archive":    ["ADMIN"],
  "task:create":         ["ADMIN", "PM"],
  "task:edit":           ["ADMIN", "PM"],
  "task:archive":        ["ADMIN"],
  "task:import":         ["ADMIN", "PM"],
  "task:updateStatus":   ["ADMIN", "PM"],
  "journalEntry:create": ["ADMIN", "BOOKKEEPER"],
  "journalEntry:reverse":["ADMIN"],
  "partner:create":      ["ADMIN"],
  "partner:edit":        ["ADMIN"],
  "partner:archive":     ["ADMIN"],
  "account:create":      ["ADMIN"],
  "account:archive":     ["ADMIN"],
  "user:create":         ["ADMIN"],
  "user:edit":           ["ADMIN"],
  "user:archive":        ["ADMIN"],
  "project:edit":        ["ADMIN"],
  "settings:edit":       ["ADMIN", "PM"],
  "auditLog:read":       ["ADMIN"],
};

export function can(role: string, action: Action): boolean {
  return (matrix[action] as string[]).includes(role);
}

export function requirePermission(
  session: Session | null,
  action: Action
): void {
  if (!session?.user?.role) throw new Error("Unauthenticated");
  if (!can(session.user.role, action)) {
    throw new Error(`Forbidden: requires permission for '${action}'`);
  }
}

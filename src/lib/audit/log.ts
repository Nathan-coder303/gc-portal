import { prisma } from "@/lib/prisma";
import { AuditAction, EntityType } from "@prisma/client";

export type ChangeRecord = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

export type WriteAuditLogInput = {
  companyId: string;
  projectId?: string | null;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  changes?: ChangeRecord[];
  reason?: string | null;
  userId: string;
  userName: string;
};

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      projectId: input.projectId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      changes: JSON.stringify(input.changes ?? []),
      reason: input.reason ?? null,
      userId: input.userId,
      userName: input.userName,
    },
  });
}

/** Diff two flat objects and return only changed fields */
export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  for (const key of keys) {
    const oldVal = before[key] == null ? null : String(before[key]);
    const newVal = after[key] == null ? null : String(after[key]);
    if (oldVal !== newVal) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }
  return changes;
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLead } from "@/app/[companyId]/leads/actions";
import LeadTime from "@/components/today/LeadTime";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  projectType: string | null;
  message: string | null;
  receivedAt: Date;
  status: string;
};

export default function LeadCard({ lead, companyId }: { lead: Lead; companyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isNew = lead.status === "NEW";

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete lead for ${lead.name ?? "Unknown"}?`)) return;
    startTransition(async () => {
      await deleteLead(lead.id);
      router.refresh();
    });
  }

  return (
    <div
      onClick={() => router.push(`/${companyId}/leads`)}
      className="rounded-xl p-5 flex flex-col gap-3 relative group cursor-pointer transition-all"
      style={{
        background: "#161b22",
        border: isNew ? "1px solid #C9A84C55" : "1px solid #30373f",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      {/* Delete button — appears on hover */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center text-xs"
        style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
        title="Delete lead"
      >
        ×
      </button>

      {/* Status badge */}
      {isNew && (
        <span
          className="absolute top-3 right-10 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: "#C9A84C", color: "#0d1117" }}
        >
          New
        </span>
      )}

      {/* Name */}
      <div>
        <h3
          className="text-lg font-bold leading-tight pr-20"
          style={{ color: "#e6edf3", fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {lead.name ?? "Unknown"}
        </h3>
        {lead.projectType && (
          <span
            className="inline-block mt-1 text-xs px-2 py-0.5 rounded"
            style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C33" }}
          >
            {lead.projectType}
          </span>
        )}
      </div>

      {/* Contact details */}
      <div className="space-y-1.5">
        {lead.email && (
          <div className="flex items-center gap-2">
            <span style={{ color: "#484f58" }}>✉</span>
            <a
              href={`mailto:${lead.email}`}
              onClick={e => e.stopPropagation()}
              className="text-sm hover:underline"
              style={{ color: "#58a6ff" }}
            >
              {lead.email}
            </a>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <span style={{ color: "#484f58" }}>📞</span>
            <a
              href={`tel:${lead.phone}`}
              onClick={e => e.stopPropagation()}
              className="text-sm hover:underline"
              style={{ color: "#e6edf3" }}
            >
              {lead.phone}
            </a>
          </div>
        )}
        {(lead.address || lead.city || lead.state) && (
          <div className="flex items-start gap-2">
            <span style={{ color: "#484f58" }}>📍</span>
            <span className="text-sm" style={{ color: "#8b949e" }}>
              {[lead.address, lead.city, lead.state].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* Message */}
      {lead.message && (
        <p
          className="text-xs leading-relaxed"
          style={{ color: "#8b949e", borderTop: "1px solid #21262d", paddingTop: "10px" }}
        >
          {lead.message.slice(0, 200)}{lead.message.length > 200 ? "…" : ""}
        </p>
      )}

      {/* Date */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs" style={{ color: "#484f58" }}>
          <LeadTime iso={lead.receivedAt.toISOString()} />
        </span>
        <span className="text-xs" style={{ color: "#484f58" }}>via email</span>
      </div>
    </div>
  );
}

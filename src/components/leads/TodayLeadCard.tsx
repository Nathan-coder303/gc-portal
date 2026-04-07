"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLead } from "@/app/[companyId]/leads/actions";
import LeadTime from "@/components/today/LeadTime";
import { TrashIcon } from "@/components/ui/icons";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  projectType: string | null;
  message: string | null;
  city: string | null;
  state: string | null;
  receivedAt: Date;
};

export default function TodayLeadCard({
  lead,
}: {
  lead: Lead;
  companyId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Navigation handled by parent <Link> wrapper

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await deleteLead(lead.id);
      router.refresh();
    });
  }

  return (
    <li
      className="flex flex-col gap-0.5 pb-3 relative group rounded-lg px-1 -mx-1"
      style={{ borderBottom: "1px solid #21262d", opacity: isPending ? 0.4 : 1 }}
    >
      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center"
        style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
        title="Delete"
      >
        <TrashIcon size={11} />
      </button>

      <span className="text-sm font-semibold pr-5" style={{ color: "#e6edf3" }}>
        {lead.name ?? "Unknown"}
      </span>

      {lead.projectType && (
        <span
          className="text-xs px-1.5 py-0.5 rounded self-start"
          style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
        >
          {lead.projectType}
        </span>
      )}

      {lead.email && (
        <a
          href={`mailto:${lead.email}`}
          onClick={e => e.stopPropagation()}
          className="text-xs hover:underline"
          style={{ color: "#58a6ff" }}
        >
          {lead.email}
        </a>
      )}

      {lead.phone && (
        <a
          href={`tel:${lead.phone}`}
          onClick={e => e.stopPropagation()}
          className="text-xs font-medium hover:underline"
          style={{ color: "#60a5fa" }}
        >
          📞 {lead.phone}
        </a>
      )}

      {(lead.city || lead.state) && (
        <span className="text-xs" style={{ color: "#8b949e" }}>
          {[lead.city, lead.state].filter(Boolean).join(", ")}
        </span>
      )}

      {lead.message && (
        <span className="text-xs leading-relaxed" style={{ color: "#8b949e" }}>
          {lead.message.slice(0, 100)}{lead.message.length > 100 ? "…" : ""}
        </span>
      )}

      <span className="text-xs" style={{ color: "#484f58" }}>
        <LeadTime iso={lead.receivedAt.toISOString()} />
      </span>
    </li>
  );
}

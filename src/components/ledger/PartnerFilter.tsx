"use client";

import { useRouter, usePathname } from "next/navigation";

type Partner = { id: string; name: string };

export default function PartnerFilter({
  partners,
  selectedId,
}: {
  partners: Partner[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (partners.length === 0) return null;

  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        if (val) {
          router.push(`${pathname}?partner=${val}`);
        } else {
          router.push(pathname);
        }
      }}
      className="rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none"
      style={{ background: "#1e2736", border: "1px solid #C9A84C55", color: "#e6edf3" }}
    >
      <option value="">All Partners</option>
      {partners.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

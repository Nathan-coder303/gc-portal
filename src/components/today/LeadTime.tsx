"use client";

export default function LeadTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <span>
      {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      {" · "}
      {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

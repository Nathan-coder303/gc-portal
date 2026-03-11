import { SubBidRow } from "./SubsBidsTab";

type Props = {
  subBids: SubBidRow[];
  clientName: string;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClientBidTab({ subBids, clientName }: Props) {
  // For each division, find the lowest received bid
  const divisions = subBids.map((bid) => {
    const received = bid.offers.filter((o) => !o.isPlaceholder && o.status !== "MISSING" && (o.amount !== null || o.contractorName));
    const sorted = [...received].sort((a, b) => {
      if (a.amount === null && b.amount === null) return 0;
      if (a.amount === null) return 1;
      if (b.amount === null) return -1;
      return a.amount - b.amount;
    });
    const best = sorted[0] ?? null;
    const others = sorted.slice(1);
    return { bid, best, others };
  });

  const total = divisions.reduce((sum, { best }) => sum + (best?.amount ?? 0), 0);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>
          Client Bid Summary — {clientName}
        </h2>
        <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
          Lowest bid per division. All amounts received shown.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
        {/* Header */}
        <div className="grid text-xs font-semibold uppercase tracking-wider px-4 py-2.5"
          style={{ background: "#1e2736", color: "#8b949e", gridTemplateColumns: "1.5fr 1.5fr 1.5fr 1.2fr 0.8fr" }}>
          <span>Division</span>
          <span>Best Contractor</span>
          <span>Other Bids</span>
          <span className="text-right">Best Amount</span>
          <span className="text-right">Status</span>
        </div>

        {divisions.map(({ bid, best, others }) => {
          const hasBid = !!best;
          const borderColor = hasBid ? "#C9A84C" : "#ef4444";

          return (
            <div key={bid.divisionCode}
              className="grid items-start px-4 py-3 text-sm gap-x-2"
              style={{ gridTemplateColumns: "1.5fr 1.5fr 1.5fr 1.2fr 0.8fr", borderTop: "1px solid #30373f", borderLeft: `3px solid ${borderColor}`, background: "#0d1117" }}>
              {/* Division */}
              <div>
                <span className="text-xs" style={{ color: "#8b949e" }}>{bid.divisionCode}</span>{" "}
                <span style={{ color: "#e6edf3" }}>{bid.divisionName}</span>
              </div>

              {/* Best contractor */}
              <div style={{ color: "#8b949e" }}>{best?.contractorName ?? "—"}</div>

              {/* Other bids */}
              <div className="space-y-0.5">
                {others.length === 0 ? (
                  <span style={{ color: "#30373f" }}>—</span>
                ) : (
                  others.map((o, i) => (
                    <div key={i} className="text-xs" style={{ color: "#8b949e" }}>
                      {o.contractorName ?? "Unknown"}{o.amount !== null ? ` — $${fmt(o.amount)}` : ""}
                    </div>
                  ))
                )}
              </div>

              {/* Best amount */}
              <div className="text-right font-semibold" style={{ color: hasBid ? "#C9A84C" : "#8b949e" }}>
                {best?.amount !== null && best?.amount !== undefined ? `$${fmt(best.amount)}` : "—"}
              </div>

              {/* Status */}
              <div className="text-right">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: (hasBid ? "#C9A84C" : "#ef4444") + "22", color: hasBid ? "#C9A84C" : "#ef4444", border: `1px solid ${hasBid ? "#C9A84C" : "#ef4444"}55` }}>
                  {hasBid ? "RECEIVED" : "MISSING"}
                </span>
              </div>
            </div>
          );
        })}

        {/* Total */}
        <div className="flex items-center justify-between px-4 py-4" style={{ background: "#1e2736", borderTop: "1px solid #30373f" }}>
          <span className="text-sm font-semibold" style={{ color: "#8b949e" }}>Total (Lowest Bids)</span>
          <span className="text-2xl font-bold" style={{ color: "#C9A84C" }}>${fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

import { SubBidRow } from "./SubsBidsTab";

type Props = {
  subBids: SubBidRow[];
  clientName: string;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusColor(status: string): string {
  switch (status) {
    case "RECEIVED":
      return "#C9A84C";
    case "APPROVED":
      return "#22c55e";
    default:
      return "#ef4444";
  }
}

export default function ClientBidTab({ subBids, clientName }: Props) {
  const total = subBids.reduce((sum, b) => {
    if (b.status !== "MISSING" && b.amount !== null) return sum + b.amount;
    return sum;
  }, 0);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>
          Client Bid Summary &mdash; {clientName}
        </h2>
        <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
          Aggregated sub-bids across all 14 divisions.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
        {/* Table header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wider px-4 py-2.5"
          style={{
            background: "#1e2736",
            color: "#8b949e",
            gridTemplateColumns: "2fr 2fr 1.5fr 1fr",
          }}
        >
          <span>Division</span>
          <span>Contractor</span>
          <span className="text-right">Bid Amount</span>
          <span className="text-right">Status</span>
        </div>

        {/* Rows */}
        {subBids.map((bid) => {
          const isMissing = bid.status === "MISSING";
          const borderColor = isMissing ? "#ef4444" : "#C9A84C";

          return (
            <div
              key={bid.divisionCode}
              className="grid items-center px-4 py-3 text-sm"
              style={{
                gridTemplateColumns: "2fr 2fr 1.5fr 1fr",
                borderTop: "1px solid #30373f",
                borderLeft: `3px solid ${borderColor}`,
                background: "#0d1117",
              }}
            >
              <div>
                <span className="font-mono text-xs" style={{ color: "#8b949e" }}>
                  {bid.divisionCode}
                </span>{" "}
                <span style={{ color: "#e6edf3" }}>{bid.divisionName}</span>
              </div>
              <div style={{ color: "#8b949e" }}>{bid.contractorName ?? "—"}</div>
              <div className="text-right font-semibold" style={{ color: bid.amount !== null ? "#C9A84C" : "#8b949e" }}>
                {bid.amount !== null ? `$${fmt(bid.amount)}` : "—"}
              </div>
              <div className="text-right">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: statusColor(bid.status) + "22",
                    color: statusColor(bid.status),
                    border: `1px solid ${statusColor(bid.status)}55`,
                  }}
                >
                  {bid.status}
                </span>
              </div>
            </div>
          );
        })}

        {/* Footer total */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ background: "#1e2736", borderTop: "1px solid #30373f" }}
        >
          <span className="text-sm font-semibold" style={{ color: "#8b949e" }}>
            Total (Received Bids)
          </span>
          <span className="text-2xl font-bold" style={{ color: "#C9A84C" }}>
            ${fmt(total)}
          </span>
        </div>
      </div>

      <p className="text-xs mt-4" style={{ color: "#8b949e" }}>
        Create estimate from sub bids coming soon
      </p>
    </div>
  );
}

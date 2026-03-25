"use client";

import { useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PipelineCardData = {
  id: string;
  displayName: string;
  stage: string;
  estimateValue: number | null;
  notes: string | null;
  clientId: string | null;
  clientName: string | null;
  sortOrder: number;
  createdAt: string;
};

type ClientOption = { id: string; name: string };

type Props = {
  companyId: string;
  initialCards: PipelineCardData[];
  clients: ClientOption[];
};

// ─── Stage Config ─────────────────────────────────────────────────────────────

const STAGES = [
  { id: "NEW_LEAD",            label: "New Lead",            color: "#3b82f6" },
  { id: "CONSULTATION_BOOKED", label: "Consultation Booked", color: "#a855f7" },
  { id: "ESTIMATE_SENT",       label: "Estimate Sent",       color: "#C9A84C" },
  { id: "FOLLOW_UP",           label: "Follow Up",           color: "#f97316" },
  { id: "CLOSED_WON",          label: "Closed Won",          color: "#22c55e" },
  { id: "NOT_INTERESTED",      label: "Not Interested",      color: "#6b7280" },
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#3b82f6", "#a855f7", "#C9A84C", "#f97316", "#22c55e",
  "#ec4899", "#14b8a6", "#ef4444", "#8b5cf6", "#f59e0b",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

// ─── Add Card Form ─────────────────────────────────────────────────────────────

type AddCardFormProps = {
  stageId: string;
  clients: ClientOption[];
  onSave: (card: PipelineCardData) => void;
  onCancel: () => void;
  companyId: string;
};

function AddCardForm({ stageId, clients, onSave, onCancel, companyId }: AddCardFormProps) {
  const [clientId, setClientId] = useState("");
  const [manualName, setManualName] = useState("");
  const [estimateValue, setEstimateValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const displayName = clientId
    ? (clients.find((c) => c.id === clientId)?.name ?? manualName)
    : manualName;

  async function handleSave() {
    const name = displayName.trim();
    if (!name) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/${companyId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          clientId: clientId || undefined,
          stage: stageId,
          estimateValue: estimateValue ? parseFloat(estimateValue) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create card");
      const data = await res.json();
      onSave({
        id: data.id,
        displayName: data.displayName,
        stage: data.stage,
        estimateValue: data.estimateValue != null ? Number(data.estimateValue) : null,
        notes: data.notes,
        clientId: data.clientId,
        clientName: data.client?.name ?? null,
        sortOrder: data.sortOrder,
        createdAt: data.createdAt,
      });
    } catch {
      setError("Failed to save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30373f",
        borderRadius: 8,
        padding: "10px 12px",
        margin: "0 8px 8px",
      }}
    >
      {/* Client select or manual name */}
      <select
        value={clientId}
        onChange={(e) => { setClientId(e.target.value); setManualName(""); setError(""); }}
        style={{
          width: "100%",
          background: "#0d1117",
          color: clientId ? "#e6edf3" : "#8b949e",
          border: "1px solid #30373f",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 13,
          marginBottom: 6,
        }}
      >
        <option value="">— Select existing client —</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {!clientId && (
        <input
          type="text"
          placeholder="Or type a name..."
          value={manualName}
          onChange={(e) => { setManualName(e.target.value); setError(""); }}
          style={{
            width: "100%",
            background: "#0d1117",
            color: "#e6edf3",
            border: "1px solid #30373f",
            borderRadius: 6,
            padding: "5px 8px",
            fontSize: 13,
            marginBottom: 6,
            boxSizing: "border-box",
          }}
        />
      )}

      <input
        type="number"
        placeholder="Estimate value (optional)"
        value={estimateValue}
        onChange={(e) => setEstimateValue(e.target.value)}
        style={{
          width: "100%",
          background: "#0d1117",
          color: "#e6edf3",
          border: "1px solid #30373f",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 13,
          marginBottom: 6,
          boxSizing: "border-box",
        }}
      />

      {error && (
        <p style={{ color: "#ef4444", fontSize: 11, marginBottom: 6 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            background: "#C9A84C",
            color: "#0d1117",
            border: "none",
            borderRadius: 6,
            padding: "5px 0",
            fontSize: 12,
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            background: "transparent",
            color: "#8b949e",
            border: "1px solid #30373f",
            borderRadius: 6,
            padding: "5px 0",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Pipeline Card ─────────────────────────────────────────────────────────────

type CardProps = {
  card: PipelineCardData;
  onDragStart: (e: React.DragEvent, cardId: string) => void;
  onDelete: (cardId: string) => void;
};

function PipelineCardComponent({ card, onDragStart, onDelete }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const name = card.clientName ?? card.displayName;

  return (
    <div
      draggable
      onDragStart={(e) => { setDragging(true); onDragStart(e, card.id); }}
      onDragEnd={() => setDragging(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && !dragging ? "#12181f" : "#0d1117",
        border: "1px solid #30373f",
        borderRadius: 8,
        padding: 12,
        margin: "0 8px 8px",
        cursor: dragging ? "grabbing" : "grab",
        opacity: dragging ? 0.5 : 1,
        transform: hovered && !dragging ? "scale(1.02)" : "scale(1)",
        transition: "transform 0.12s ease, background 0.12s ease",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          background: "transparent",
          border: "none",
          color: "#6b7280",
          fontSize: 14,
          cursor: "pointer",
          lineHeight: 1,
          padding: "0 2px",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.1s",
        }}
        title="Remove from pipeline"
      >
        ×
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: getAvatarColor(name),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          {getInitials(name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#e6edf3",
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>

          {card.estimateValue != null && (
            <div style={{ color: "#C9A84C", fontSize: 12, fontWeight: 600 }}>
              {formatCurrency(card.estimateValue)}
            </div>
          )}
        </div>
      </div>

      {card.notes && (
        <div
          style={{
            color: "#8b949e",
            fontSize: 11,
            marginTop: 7,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.notes}
        </div>
      )}

      <div style={{ color: "#6b7280", fontSize: 10, marginTop: 6 }}>
        {formatRelativeTime(card.createdAt)}
      </div>
    </div>
  );
}

// ─── Add to Pipeline Modal ─────────────────────────────────────────────────────

type AddModalProps = {
  companyId: string;
  clients: ClientOption[];
  onSave: (card: PipelineCardData) => void;
  onClose: () => void;
};

function AddToPipelineModal({ companyId, clients, onSave, onClose }: AddModalProps) {
  const [clientId, setClientId] = useState("");
  const [manualName, setManualName] = useState("");
  const [stage, setStage] = useState("NEW_LEAD");
  const [estimateValue, setEstimateValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const displayName = clientId
    ? (clients.find((c) => c.id === clientId)?.name ?? manualName)
    : manualName;

  async function handleSave() {
    const name = displayName.trim();
    if (!name) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/${companyId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          clientId: clientId || undefined,
          stage,
          estimateValue: estimateValue ? parseFloat(estimateValue) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onSave({
        id: data.id,
        displayName: data.displayName,
        stage: data.stage,
        estimateValue: data.estimateValue != null ? Number(data.estimateValue) : null,
        notes: data.notes,
        clientId: data.clientId,
        clientName: data.client?.name ?? null,
        sortOrder: data.sortOrder,
        createdAt: data.createdAt,
      });
    } catch {
      setError("Failed to save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30373f",
          borderRadius: 12,
          padding: 24,
          width: 420,
          maxWidth: "95vw",
        }}
      >
        <h3 style={{ color: "#e6edf3", fontWeight: 700, fontSize: 16, marginBottom: 16, marginTop: 0 }}>
          Add to Pipeline
        </h3>

        <label style={{ display: "block", color: "#8b949e", fontSize: 12, marginBottom: 4 }}>Client</label>
        <select
          value={clientId}
          onChange={(e) => { setClientId(e.target.value); setManualName(""); setError(""); }}
          style={{
            width: "100%",
            background: "#0d1117",
            color: clientId ? "#e6edf3" : "#8b949e",
            border: "1px solid #30373f",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 13,
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        >
          <option value="">— Select existing client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {!clientId && (
          <>
            <label style={{ display: "block", color: "#8b949e", fontSize: 12, marginBottom: 4 }}>Or enter name manually</label>
            <input
              type="text"
              placeholder="Prospect name..."
              value={manualName}
              onChange={(e) => { setManualName(e.target.value); setError(""); }}
              style={{
                width: "100%",
                background: "#0d1117",
                color: "#e6edf3",
                border: "1px solid #30373f",
                borderRadius: 6,
                padding: "7px 10px",
                fontSize: 13,
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />
          </>
        )}

        <label style={{ display: "block", color: "#8b949e", fontSize: 12, marginBottom: 4 }}>Stage</label>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          style={{
            width: "100%",
            background: "#0d1117",
            color: "#e6edf3",
            border: "1px solid #30373f",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 13,
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        <label style={{ display: "block", color: "#8b949e", fontSize: 12, marginBottom: 4 }}>Estimate Value (optional)</label>
        <input
          type="number"
          placeholder="$0"
          value={estimateValue}
          onChange={(e) => setEstimateValue(e.target.value)}
          style={{
            width: "100%",
            background: "#0d1117",
            color: "#e6edf3",
            border: "1px solid #30373f",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 13,
            marginBottom: 10,
            boxSizing: "border-box",
          }}
        />

        <label style={{ display: "block", color: "#8b949e", fontSize: 12, marginBottom: 4 }}>Notes (optional)</label>
        <textarea
          placeholder="Any notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{
            width: "100%",
            background: "#0d1117",
            color: "#e6edf3",
            border: "1px solid #30373f",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 13,
            marginBottom: 14,
            boxSizing: "border-box",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />

        {error && (
          <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "#8b949e",
              border: "1px solid #30373f",
              borderRadius: 6,
              padding: "7px 16px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "#C9A84C",
              color: "#0d1117",
              border: "none",
              borderRadius: 6,
              padding: "7px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Adding..." : "Add to Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientPipeline({ companyId, initialCards, clients }: Props) {
  const [cards, setCards] = useState<PipelineCardData[]>(initialCards);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingToStage, setAddingToStage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const draggingCardId = useRef<string | null>(null);

  const filteredCards = searchQuery.trim()
    ? cards.filter((c) =>
        (c.clientName ?? c.displayName)
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    : cards;

  function getStageCards(stageId: string) {
    return filteredCards.filter((c) => c.stage === stageId);
  }

  function getStageTotal(stageId: string) {
    return cards
      .filter((c) => c.stage === stageId && c.estimateValue != null)
      .reduce((sum, c) => sum + (c.estimateValue ?? 0), 0);
  }

  const handleDragStart = useCallback((e: React.DragEvent, cardId: string) => {
    draggingCardId.current = cardId;
    e.dataTransfer.setData("cardId", cardId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child element)
    const relTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relTarget)) {
      setDragOverStage(null);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStage: string) => {
      e.preventDefault();
      setDragOverStage(null);
      const cardId = e.dataTransfer.getData("cardId") || draggingCardId.current;
      if (!cardId) return;

      const card = cards.find((c) => c.id === cardId);
      if (!card || card.stage === targetStage) return;

      // Optimistically update
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, stage: targetStage } : c))
      );

      try {
        await fetch(`/api/${companyId}/pipeline/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: targetStage }),
        });
      } catch {
        // Revert on failure
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, stage: card.stage } : c))
        );
      }
    },
    [cards, companyId]
  );

  const handleCardAdded = useCallback((newCard: PipelineCardData) => {
    setCards((prev) => [...prev, newCard]);
    setAddingToStage(null);
  }, []);

  const handleModalSave = useCallback((newCard: PipelineCardData) => {
    setCards((prev) => [...prev, newCard]);
    setShowModal(false);
  }, []);

  const handleDelete = useCallback(
    async (cardId: string) => {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      try {
        await fetch(`/api/${companyId}/pipeline/${cardId}`, { method: "DELETE" });
      } catch {
        // Best effort
      }
    },
    [companyId]
  );

  return (
    <section>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <h2 style={{ color: "#e6edf3", fontWeight: 700, fontSize: 18, margin: 0 }}>
          Sales Pipeline
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "#161b22",
              color: "#e6edf3",
              border: "1px solid #30373f",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 13,
              width: 200,
              outline: "none",
            }}
          />
          {/* Add to Pipeline button */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: "#C9A84C",
              color: "#0d1117",
              border: "none",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Add to Pipeline
          </button>
        </div>
      </div>

      {/* Board */}
      <div
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          paddingBottom: 12,
        }}
      >
        {STAGES.map((stage) => {
          const stageCards = getStageCards(stage.id);
          const total = getStageTotal(stage.id);
          const isOver = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
              style={{
                minWidth: 280,
                width: 280,
                flexShrink: 0,
                background: isOver ? "#1a2030" : "#161b22",
                borderRadius: 12,
                overflow: "hidden",
                border: isOver
                  ? `2px solid ${stage.color}`
                  : "2px solid transparent",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: "16px 14px 12px",
                  background: "#1e2736",
                  borderTop: `3px solid ${stage.color}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: total > 0 ? 4 : 0,
                  }}
                >
                  <span
                    style={{
                      color: "#e6edf3",
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {stage.label}
                  </span>
                  {/* Count badge */}
                  <span
                    style={{
                      background: stage.color + "33",
                      color: stage.color,
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 20,
                      padding: "1px 8px",
                      border: `1px solid ${stage.color}55`,
                    }}
                  >
                    {stageCards.length}
                  </span>
                </div>
                {total > 0 && (
                  <div style={{ color: "#8b949e", fontSize: 11 }}>
                    {formatCurrency(total)} total
                  </div>
                )}
              </div>

              {/* Cards list */}
              <div
                style={{
                  minHeight: 60,
                  paddingTop: 8,
                }}
              >
                {stageCards.map((card) => (
                  <PipelineCardComponent
                    key={card.id}
                    card={card}
                    onDragStart={handleDragStart}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              {/* Add card inline form or button */}
              {addingToStage === stage.id ? (
                <AddCardForm
                  stageId={stage.id}
                  clients={clients}
                  companyId={companyId}
                  onSave={handleCardAdded}
                  onCancel={() => setAddingToStage(null)}
                />
              ) : (
                <button
                  onClick={() => setAddingToStage(stage.id)}
                  style={{
                    display: "block",
                    width: "calc(100% - 16px)",
                    margin: "4px 8px 10px",
                    background: "transparent",
                    color: "#8b949e",
                    border: "1px dashed #30373f",
                    borderRadius: 6,
                    padding: "6px 0",
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "color 0.1s, border-color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = stage.color;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = stage.color;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#8b949e";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#30373f";
                  }}
                >
                  + Add Client
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add to Pipeline modal */}
      {showModal && (
        <AddToPipelineModal
          companyId={companyId}
          clients={clients}
          onSave={handleModalSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  );
}

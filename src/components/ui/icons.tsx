import React from "react";

export function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

export function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function SaveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export function PencilIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function FilePlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

export function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Eye — Preview */
export function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C4 7 8 4 12 4s8 3 10 8c-2 5-6 8-10 8S4 17 2 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

/** Envelope — Send */
export function EnvelopeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <polyline points="2 5 12 13 22 5"/>
    </svg>
  );
}

/** Down arrow with base — Download */
export function DownloadArrowIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="15"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="4" y1="20" x2="20" y2="20"/>
    </svg>
  );
}

/** Tower crane — Construction Page */
export function CraneIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="22" x2="8" y2="5"/>
      <line x1="8" y1="5" x2="21" y2="5"/>
      <line x1="8" y1="5" x2="3" y2="8"/>
      <line x1="21" y1="5" x2="21" y2="13"/>
      <path d="M19 15 Q21 17 23 15" strokeWidth="1.5"/>
      <line x1="11" y1="5" x2="8" y2="11"/>
      <line x1="17" y1="5" x2="8" y2="14"/>
      <rect x="5" y="18" width="6" height="4" rx="1"/>
    </svg>
  );
}

/** Set square + ruler — Permit Drawings */
export function DraftingIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 L4 4 L17 20 Z"/>
      <line x1="4" y1="8" x2="8" y2="8"/>
      <line x1="4" y1="12" x2="11" y2="12"/>
      <line x1="4" y1="16" x2="14" y2="16"/>
      <rect x="18" y="2" width="3" height="18" rx="1.5"/>
      <line x1="18" y1="6" x2="21" y2="6"/>
      <line x1="18" y1="10" x2="21" y2="10"/>
      <line x1="18" y1="14" x2="21" y2="14"/>
    </svg>
  );
}

/** House with chimney — Roofing Cover Page */
export function HouseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11 L12 3 L21 11 V21 H3 Z"/>
      <path d="M9 21 V16 H15 V21"/>
      <rect x="6" y="13" width="3" height="3" rx="0.5"/>
      <rect x="15" y="13" width="3" height="3" rx="0.5"/>
      <rect x="15" y="5" width="3" height="5"/>
    </svg>
  );
}

/** Storefront — Retail */
export function StorefrontIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="20" height="12" rx="1"/>
      <path d="M2 9 Q12 5 22 9"/>
      <rect x="9" y="15" width="6" height="6"/>
      <rect x="3" y="2" width="18" height="6" rx="1"/>
      <line x1="9" y1="2" x2="9" y2="8"/>
      <line x1="15" y1="2" x2="15" y2="8"/>
    </svg>
  );
}

/** Circle with slash — None */
export function CircleSlashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <line x1="5.5" y1="18.5" x2="18.5" y2="5.5"/>
    </svg>
  );
}

/** Stacked documents — Save Template */
export function StackedDocsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="13" height="16" rx="1.5" />
      <rect x="7" y="3" width="13" height="16" rx="1.5" fill="#1a1508" />
      <rect x="7" y="3" width="13" height="16" rx="1.5" />
      <line x1="10" y1="8" x2="17" y2="8" strokeWidth="1.2" />
      <line x1="10" y1="11" x2="17" y2="11" strokeWidth="1.2" />
      <line x1="10" y1="14" x2="14" y2="14" strokeWidth="1.2" />
    </svg>
  );
}

/** Document with plus — Save as New */
export function DocPlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3h9l5 5v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <polyline points="13 3 13 8 18 8" />
      <line x1="12" y1="13" x2="12" y2="19" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  );
}

/** Clipboard with bar chart — Create Estimate */
export function ClipboardChartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3" />
      <rect x="9" y="1" width="6" height="4" rx="1" />
      <line x1="7" y1="19" x2="7" y2="14" strokeWidth="2" />
      <line x1="12" y1="19" x2="12" y2="11" strokeWidth="2" />
      <line x1="17" y1="19" x2="17" y2="8" strokeWidth="2" />
      <polyline points="7 14 12 11 17 8" strokeWidth="1.2" />
      <path d="M15 18 Q18 15 19.5 12" strokeWidth="1.2" />
    </svg>
  );
}

/** PDF document + envelope — PDF / Send */
export function PdfMailIcon({ size = 14 }: { size?: number }) {
  const w = Math.round(size * 1.5);
  return (
    <svg width={w} height={size} viewBox="0 0 36 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 2h7l4 4v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <polyline points="8 2 8 6 12 6" />
      <line x1="3" y1="11" x2="10" y2="11" strokeWidth="1.2" />
      <line x1="3" y1="14" x2="10" y2="14" strokeWidth="1.2" />
      <line x1="3" y1="17" x2="7" y2="17" strokeWidth="1.2" />
      <line x1="14" y1="12" x2="18" y2="12" />
      <polyline points="16 10 18 12 16 14" />
      <rect x="20" y="6" width="15" height="11" rx="1" />
      <polyline points="20 7 27.5 13 35 7" />
    </svg>
  );
}

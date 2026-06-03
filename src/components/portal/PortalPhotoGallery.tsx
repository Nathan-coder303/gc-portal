"use client";

import { useState, useEffect } from "react";

type Photo = { logId: string; logDate: string; id: string; name: string; mimeType: string };

const GOLD = "#C9A84C";
const CARD = "#161b22";
const BORDER = "#30373f";
const MUTED = "#8b949e";
const TEXT = "#e6edf3";

function groupByDate(photos: Photo[]) {
  const groups: Record<string, Photo[]> = {};
  for (const p of photos) {
    if (!groups[p.logDate]) groups[p.logDate] = [];
    groups[p.logDate].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function photoUrl(clientId: string, photo: Photo) {
  return `/api/client-portal/${clientId}/daily-log-photos/${photo.logId}?attachment=${photo.id}`;
}

export default function PortalPhotoGallery({ clientId }: { clientId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  useEffect(() => {
    fetch(`/api/client-portal/${clientId}/daily-log-photos`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPhotos(data); })
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p className="text-sm py-4" style={{ color: MUTED }}>Loading photos…</p>;
  if (photos.length === 0) return <p className="text-sm" style={{ color: "#484f58" }}>No site photos yet.</p>;

  const groups = groupByDate(photos);

  return (
    <>
      <p className="text-xs mb-4" style={{ color: MUTED }}>Please click on a picture to enlarge it.</p>
      <div className="space-y-6">
        {groups.map(([date, group]) => {
          const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          });
          return (
            <div key={date}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: MUTED }}>{label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {group.map(photo => {
                  const url = photoUrl(clientId, photo);
                  return (
                    <div
                      key={photo.id}
                      className="rounded-xl overflow-hidden cursor-pointer"
                      style={{ background: CARD, border: `1px solid ${BORDER}` }}
                      onClick={() => setLightbox(photo)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={photo.name}
                        className="w-full object-cover"
                        style={{ aspectRatio: "4/3" }}
                      />
                      <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                        <span className="text-xs truncate" style={{ color: MUTED }}>{photo.name}</span>
                        <a
                          href={url}
                          download={photo.name}
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 text-xs px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}
                        >
                          ↓
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(clientId, lightbox)}
              alt={lightbox.name}
              className="w-full rounded-2xl"
              style={{ maxHeight: "80vh", objectFit: "contain", border: `1px solid ${BORDER}` }}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: TEXT }}>{lightbox.name}</span>
              <div className="flex gap-2">
                <a
                  href={photoUrl(clientId, lightbox)}
                  download={lightbox.name}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: GOLD, color: "#0d1117" }}
                >
                  Download
                </a>
                <button
                  onClick={() => setLightbox(null)}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

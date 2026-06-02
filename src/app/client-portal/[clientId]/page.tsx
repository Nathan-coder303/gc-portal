import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import PortalMessages from "@/components/portal/PortalMessages";
import PortalPhotoGallery from "@/components/portal/PortalPhotoGallery";
import PortalDailyLogs from "@/components/portal/PortalDailyLogs";

export const dynamic = "force-dynamic";

const DOC_CATEGORIES: Record<string, { label: string; color: string }> = {
  PERMIT_CARD:        { label: "Permit Card",        color: "#22c55e" },
  PERMIT_APPLICATION: { label: "Permit Application", color: "#3b82f6" },
  NOC:                { label: "Notice of Commencement (NOC)", color: "#C9A84C" },
  OTHER:              { label: "Other Document",     color: "#8b949e" },
};

export default async function ClientPortalPage({ params }: { params: { clientId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    redirect("/login");
  }

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    include: {
      portalDocs: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!client) redirect("/login");

  const showMessages    = client.portalShowMessages;
  const showDailyPhotos = client.portalShowDailyPhotos;
  const showDocuments   = client.portalShowDocuments;
  const showDailyLogs   = client.portalShowDailyLogs;

  const docsByCategory: Record<string, typeof client.portalDocs> = {};
  for (const doc of client.portalDocs) {
    if (!docsByCategory[doc.category]) docsByCategory[doc.category] = [];
    docsByCategory[doc.category].push(doc);
  }

  const catOrder = ["PERMIT_CARD", "PERMIT_APPLICATION", "NOC", "OTHER"];

  return (
    <div className="min-h-screen" style={{ background: "#0d1117", color: "#e6edf3" }}>
      {/* Header */}
      <div style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#C9A84C" }}>
              MIBH Construction
            </div>
            <div className="text-lg font-bold" style={{ color: "#e6edf3" }}>{client.name}</div>
            {client.address && (
              <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                {[client.address, client.city, client.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}>
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* ── Messages ── */}
        {showMessages && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#C9A84C" }}>
              Messages
            </h2>
            <PortalMessages clientId={client.id} />
          </section>
        )}

        {/* ── Site Photo Gallery ── */}
        {showDailyPhotos && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#C9A84C" }}>
              Site Photos
            </h2>
            <PortalPhotoGallery clientId={client.id} />
          </section>
        )}

        {/* ── Documents ── */}
        {showDocuments && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#3b82f6" }}>
              Project Documents
            </h2>

            {client.portalDocs.length === 0 ? (
              <p className="text-sm" style={{ color: "#484f58" }}>No documents have been uploaded yet.</p>
            ) : (
              <div className="space-y-6">
                {catOrder.filter(cat => docsByCategory[cat]?.length).map(cat => {
                  const meta = DOC_CATEGORIES[cat] ?? { label: cat, color: "#8b949e" };
                  return (
                    <div key={cat}>
                      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: meta.color }}>
                        {meta.label}
                      </div>
                      <div className="space-y-2">
                        {docsByCategory[cat].map(doc => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between px-4 py-3 rounded-xl"
                            style={{ background: "#161b22", border: "1px solid #30373f" }}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{doc.label}</div>
                              <div className="text-xs mt-0.5" style={{ color: "#484f58" }}>
                                {doc.fileName} · {(doc.fileSize / 1024).toFixed(0)} KB · {new Date(doc.uploadedAt).toLocaleDateString("en-US")}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0 ml-3">
                              <a
                                href={`/api/client-portal/${client.id}/docs/${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                                style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}
                              >
                                View
                              </a>
                              <a
                                href={`/api/client-portal/${client.id}/docs/${doc.id}?download=1`}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                                style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
                              >
                                ↓
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Daily Logs ── */}
        {showDailyLogs && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#C9A84C" }}>
              Daily Logs
            </h2>
            <PortalDailyLogs clientId={client.id} />
          </section>
        )}

        {/* Empty state */}
        {!showMessages && !showDailyPhotos && !showDocuments && !showDailyLogs && (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: "#484f58" }}>Your portal content is being set up. Check back soon.</p>
          </div>
        )}

        <div className="text-center text-xs pb-8" style={{ color: "#30373f" }}>
          MIBH Construction · Client Portal · Questions? Call 305-746-7307
        </div>
      </div>
    </div>
  );
}

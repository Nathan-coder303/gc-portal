import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import PortalMessages from "@/components/portal/PortalMessages";

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

  // CLIENT can only see their own portal; admins can see any
  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    redirect("/login");
  }

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    include: {
      portalPhotos: { orderBy: [{ sortOrder: "asc" }, { uploadedAt: "desc" }] },
      portalDocs:   { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!client) redirect("/login");

  // Group docs by category
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
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#C9A84C" }}>MIBH Construction</div>
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
        {/* ── Photos ── */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#C9A84C" }}>
            Project Photos
          </h2>

          {client.portalPhotos.length === 0 ? (
            <p className="text-sm" style={{ color: "#484f58" }}>No photos have been uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {client.portalPhotos.map(photo => (
                <div key={photo.id} className="rounded-xl overflow-hidden" style={{ background: "#161b22", border: "1px solid #30373f" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/client-portal/${client.id}/photos/${photo.id}`}
                    alt={photo.caption ?? photo.fileName}
                    className="w-full object-cover"
                    style={{ aspectRatio: "4/3" }}
                  />
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs truncate" style={{ color: "#8b949e" }}>
                      {photo.caption || photo.fileName}
                    </span>
                    <a
                      href={`/api/client-portal/${client.id}/photos/${photo.id}`}
                      download={photo.fileName}
                      className="text-xs px-2 py-1 rounded font-semibold shrink-0"
                      style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                    >
                      ↓
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Documents ── */}
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
                              ↓ Download
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

        {/* ── Messages ── */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: "#C9A84C" }}>
            Messages
          </h2>
          <PortalMessages clientId={client.id} />
        </section>

        <div className="text-center text-xs pb-8" style={{ color: "#30373f" }}>
          MIBH Construction · Client Portal · Questions? Call 305-746-7307
        </div>
      </div>
    </div>
  );
}

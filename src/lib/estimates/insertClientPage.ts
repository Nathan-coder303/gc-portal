import { PDFDocument } from "pdf-lib";

/**
 * If the client has a file marked useInEstimate, fetch that PDF,
 * extract page 2 (index 1), and insert it as page 3 (index 2) of the estimate.
 * Returns the modified buffer, or the original if no insert file exists.
 */
export async function insertClientPageIntoEstimate(
  estimateBuffer: Buffer,
  insertPdfUrl: string | null | undefined
): Promise<Buffer> {
  if (!insertPdfUrl) return estimateBuffer;

  try {
    // Fetch the source PDF (private blob requires Bearer token)
    const sourceRes = await fetch(insertPdfUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!sourceRes.ok) {
      console.error("insertClientPageIntoEstimate: fetch failed", sourceRes.status, insertPdfUrl);
      return estimateBuffer;
    }
    const sourceBytes = Buffer.from(await sourceRes.arrayBuffer());
    const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });

    const pageCount = sourcePdf.getPageCount();
    console.log("insertClientPageIntoEstimate: source page count =", pageCount);

    // Use page 2 if it exists, otherwise page 1
    const sourcePageIndex = pageCount >= 2 ? 1 : 0;

    // Load the estimate PDF
    const estimatePdf = await PDFDocument.load(Buffer.from(estimateBuffer), { ignoreEncryption: true });

    // Copy the chosen page from source
    const [insertedPage] = await estimatePdf.copyPages(sourcePdf, [sourcePageIndex]);

    // Insert as page 3 (index 2)
    const insertAt = Math.min(2, estimatePdf.getPageCount());
    estimatePdf.insertPage(insertAt, insertedPage);

    console.log("insertClientPageIntoEstimate: inserted at index", insertAt, "total pages now", estimatePdf.getPageCount());

    const merged = await estimatePdf.save();
    return Buffer.from(merged);
  } catch (err) {
    console.error("insertClientPageIntoEstimate failed:", err);
    return estimateBuffer;
  }
}

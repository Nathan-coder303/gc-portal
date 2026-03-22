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
    // Fetch the source PDF
    const sourceRes = await fetch(insertPdfUrl);
    if (!sourceRes.ok) return estimateBuffer;
    const sourceBytes = await sourceRes.arrayBuffer();
    const sourcePdf = await PDFDocument.load(sourceBytes);

    // Need at least 2 pages
    if (sourcePdf.getPageCount() < 2) return estimateBuffer;

    // Load the estimate PDF
    const estimatePdf = await PDFDocument.load(estimateBuffer);

    // Copy page 2 (index 1) from source
    const [insertedPage] = await estimatePdf.copyPages(sourcePdf, [1]);

    // Insert as page 3 (index 2) — after the cover page (0) and first estimate page (1)
    estimatePdf.insertPage(2, insertedPage);

    const merged = await estimatePdf.save();
    return Buffer.from(merged);
  } catch (err) {
    console.error("insertClientPageIntoEstimate failed:", err);
    return estimateBuffer;
  }
}

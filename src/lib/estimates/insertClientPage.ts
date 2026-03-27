import { PDFDocument, PDFName, PDFArray, PDFStream } from "pdf-lib";

/**
 * If the client has a file marked useInEstimate, fetch that PDF,
 * extract page 2 (index 1), and insert it as page 3 (index 2) of the estimate.
 * Returns the modified buffer, or the original if no insert file exists.
 *
 * Rule: if the chosen source page has no content streams (blank page),
 * skip the insertion entirely rather than adding a blank page 3.
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

    // Skip if the chosen page is blank (no content streams)
    const sourcePage = sourcePdf.getPages()[sourcePageIndex];
    const contents = sourcePage.node.get(PDFName.of("Contents"));
    if (!contents) {
      console.log("insertClientPageIntoEstimate: source page has no content, skipping insertion");
      return estimateBuffer;
    }
    // Also skip if Contents is an empty array
    if (contents instanceof PDFArray && contents.size() === 0) {
      console.log("insertClientPageIntoEstimate: source page has empty content array, skipping insertion");
      return estimateBuffer;
    }
    // Also skip if Contents is a stream with negligible size (< 10 bytes = basically blank)
    if (contents instanceof PDFStream) {
      const streamBytes = contents.getContentsString();
      if (!streamBytes || streamBytes.trim().length < 10) {
        console.log("insertClientPageIntoEstimate: source page content stream is empty, skipping insertion");
        return estimateBuffer;
      }
    }

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

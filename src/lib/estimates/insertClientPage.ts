import { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFRef } from "pdf-lib";

/**
 * If the client has a file marked useInEstimate, fetch that PDF,
 * extract page 2 (index 1), and insert it as page 3 (index 2) of the estimate.
 * Returns the modified buffer, or the original if no insert file exists.
 *
 * Rule: if the chosen source page has no meaningful content (blank page),
 * skip the insertion entirely rather than adding a blank page 3.
 */

/** Resolve a PDF object through any references, then sum up content stream byte lengths. */
function resolveContentSize(obj: unknown, context: PDFDocument["context"]): number {
  if (obj instanceof PDFRef) {
    return resolveContentSize(context.lookup(obj), context);
  }
  if (obj instanceof PDFRawStream) {
    return obj.getContentsString().trim().length;
  }
  if (obj instanceof PDFArray) {
    let total = 0;
    for (let i = 0; i < obj.size(); i++) {
      total += resolveContentSize(obj.get(i), context);
    }
    return total;
  }
  return 0;
}

export async function insertClientPageIntoEstimate(
  estimateBuffer: Buffer,
  insertPdfUrl: string | null | undefined
): Promise<Buffer> {
  if (!insertPdfUrl) return estimateBuffer;

  try {
    const sourceRes = await fetch(insertPdfUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!sourceRes.ok) {
      console.error("insertClientPageIntoEstimate: fetch failed", sourceRes.status);
      return estimateBuffer;
    }
    const sourceBytes = Buffer.from(await sourceRes.arrayBuffer());

    // Skip files that are clearly not a real PDF (< 1 KB)
    if (sourceBytes.length < 1000) {
      console.log("insertClientPageIntoEstimate: source file too small (%d bytes), skipping", sourceBytes.length);
      return estimateBuffer;
    }

    const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });

    const pageCount = sourcePdf.getPageCount();
    const sourcePageIndex = pageCount >= 2 ? 1 : 0;

    // Skip blank pages: resolve all content streams and check total size.
    // Blank pages from PDF generators typically have < 50 bytes of operators.
    // Real content pages have thousands.
    const sourcePage = sourcePdf.getPages()[sourcePageIndex];
    const contents = sourcePage.node.get(PDFName.of("Contents"));
    const contentSize = contents ? resolveContentSize(contents, sourcePdf.context) : 0;
    if (contentSize < 1500) {
      console.log("insertClientPageIntoEstimate: source page appears blank (contentSize=%d), skipping", contentSize);
      return estimateBuffer;
    }

    const estimatePdf = await PDFDocument.load(Buffer.from(estimateBuffer), { ignoreEncryption: true });
    const [insertedPage] = await estimatePdf.copyPages(sourcePdf, [sourcePageIndex]);
    const insertAt = Math.min(2, estimatePdf.getPageCount());
    estimatePdf.insertPage(insertAt, insertedPage);

    const merged = await estimatePdf.save();
    return Buffer.from(merged);
  } catch (err) {
    console.error("insertClientPageIntoEstimate failed:", err);
    return estimateBuffer;
  }
}

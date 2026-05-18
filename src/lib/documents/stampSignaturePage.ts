import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface StampOptions {
  docName: string;
  clientSignedByName: string | null;
  clientSignedAt: Date | null;
  clientSignatureData: string | null; // base64 PNG data URL, or null if already signed externally
  clientAlreadySigned: boolean;
  contractorSignatureData: string; // base64 PNG data URL
  contractorSignedAt: Date;
  contractorName?: string;
}

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function pngDataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function stampSignaturePage(originalUrl: string, opts: StampOptions): Promise<Buffer> {
  const originalBytes = await fetchPdfBytes(originalUrl);
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add signature page (US Letter)
  const page = pdfDoc.addPage([612, 792]);
  const gold = rgb(0.788, 0.659, 0.298); // #C9A84C
  const dark = rgb(0.059, 0.09, 0.165);  // #0f172a
  const gray = rgb(0.4, 0.44, 0.51);
  const lightGray = rgb(0.88, 0.90, 0.93);

  // Header bar
  page.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: dark });
  page.drawText("EXECUTION PAGE", {
    x: 30, y: 762, size: 14, font: helveticaBold, color: gold,
  });
  page.drawText(opts.docName, {
    x: 30, y: 750, size: 8, font: helvetica, color: lightGray,
  });

  const formatDate = (d: Date) =>
    d.toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });

  // Helper: draw a signature block
  async function drawSigBlock(
    label: string,
    sigDataUrl: string | null,
    printedName: string | null,
    signedAt: Date | null,
    alreadySigned: boolean,
    x: number,
    y: number,
    w: number,
  ) {
    // Section label
    page.drawText(label, { x, y, size: 9, font: helveticaBold, color: gold });

    // Signature box outline
    page.drawRectangle({ x, y: y - 80, width: w, height: 70, borderColor: lightGray, borderWidth: 0.5, color: rgb(0.97, 0.98, 0.99) });

    if (sigDataUrl) {
      try {
        const imgBytes = pngDataUrlToBytes(sigDataUrl);
        const img = await pdfDoc.embedPng(imgBytes);
        const dim = img.scaleToFit(w - 16, 60);
        page.drawImage(img, { x: x + 8, y: y - 75, width: dim.width, height: dim.height });
      } catch {
        // fallback text if image fails
        page.drawText("(signature on file)", { x: x + 8, y: y - 50, size: 9, font: helvetica, color: gray });
      }
    } else if (alreadySigned) {
      page.drawText("Signed externally (scan on file)", { x: x + 8, y: y - 45, size: 9, font: helvetica, color: gray });
    }

    // Divider line
    page.drawLine({ start: { x, y: y - 82 }, end: { x: x + w, y: y - 82 }, thickness: 0.5, color: lightGray });

    // Name
    if (printedName) {
      page.drawText("Name:", { x, y: y - 96, size: 8, font: helveticaBold, color: dark });
      page.drawText(printedName, { x: x + 36, y: y - 96, size: 8, font: helvetica, color: dark });
    }

    // Date & Time
    if (signedAt) {
      page.drawText("Date & Time:", { x, y: y - 109, size: 8, font: helveticaBold, color: dark });
      page.drawText(formatDate(signedAt), { x: x + 62, y: y - 109, size: 8, font: helvetica, color: dark });
    }
  }

  const hasClientDigitalSig = !!opts.clientSignatureData;

  if (hasClientDigitalSig) {
    // CLIENT block (left) — only when client signed digitally via link
    await drawSigBlock(
      "CLIENT SIGNATURE",
      opts.clientSignatureData,
      opts.clientSignedByName,
      opts.clientSignedAt,
      false,
      30, 700, 255,
    );

    // Vertical divider
    page.drawLine({ start: { x: 306, y: 710 }, end: { x: 306, y: 580 }, thickness: 0.5, color: lightGray });

    // CONTRACTOR block (right)
    await drawSigBlock(
      "CONTRACTOR SIGNATURE",
      opts.contractorSignatureData,
      opts.contractorName ?? "Mike Baruh",
      opts.contractorSignedAt,
      false,
      327, 700, 255,
    );
  } else {
    // Client signed externally — show only contractor block, full width centered
    await drawSigBlock(
      "CONTRACTOR SIGNATURE",
      opts.contractorSignatureData,
      opts.contractorName ?? "Mike Baruh",
      opts.contractorSignedAt,
      false,
      157, 700, 298,
    );
  }

  // Footer
  page.drawLine({ start: { x: 30, y: 555 }, end: { x: 582, y: 555 }, thickness: 0.5, color: lightGray });
  page.drawText("This document is fully executed and legally binding.", {
    x: 30, y: 540, size: 8, font: helveticaBold, color: dark,
  });
  page.drawText(`Generated by MIBH Construction Portal on ${formatDate(new Date())}`, {
    x: 30, y: 528, size: 7, font: helvetica, color: gray,
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

import { prisma } from "../src/lib/prisma";

async function main() {
  const clientId = "cmml1r793000104l1wa4skyrr";
  const bids = await prisma.subBid.findMany({
    where: { clientId },
    select: { id: true, divisionCode: true, divisionName: true, contractorName: true, status: true, isPlaceholder: true },
    orderBy: [{ divisionCode: "asc" }, { createdAt: "asc" }],
  });
  console.log("Total:", bids.length);
  const byCode: Record<string, typeof bids> = {};
  for (const b of bids) {
    if (!byCode[b.divisionCode]) byCode[b.divisionCode] = [];
    byCode[b.divisionCode].push(b);
  }
  for (const [code, items] of Object.entries(byCode)) {
    console.log(`\n[${code}] ${items[0].divisionName} — ${items.length}`);
    for (const b of items) console.log(`  "${b.contractorName ?? "(placeholder)"}" | ${b.status} | ph:${b.isPlaceholder}`);
  }
}
main().then(() => process.exit(0));

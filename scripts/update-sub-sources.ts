import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
const COMPANY_ID = "cmmij161r000004jm8il8bd0e";

// email (lowercase) → project keys
const EMAIL_MAP: Record<string, string[]> = {
  "sales.2uomo@gmail.com": ["7729"],
  "alphacd@outlook.com": ["7729"],
  "bid@americastatewide.com": ["7729"],
  "cs@gigwindows.com": ["7729"],
  "jairob@gigwindows.com": ["7729"],
  "alejandro@onairus.com": ["7729"],
  "bids@klenspace.com": ["7729", "1090", "Ingraham"],
  "contracts@klenspace.com": ["7729", "1090", "Ingraham"],
  "efipropainting@yahoo.com": ["7729"],
  "oscar@cruzelectrical.com": ["7729"],
  "connieg@nefmail.com": ["7729", "Ingraham", "1411"],
  "estimates@valrose.com": ["7729"],
  "lharris@lifesafety.net": ["7729", "1090"],
  "estimating@ecopermitpros.com": ["7729", "1090"],
  "bryvalle@flahvac.com": ["7729", "Ingraham"],
  "jose@flahvac.com": ["7729", "Ingraham"],
  "mgmt.s@impactglass.net": ["7729"],
  "mgmt.miami@impactglass.net": ["7729"],
  "sales@novadesignbuilders.com": ["7729", "Ingraham"],
  "michael@atlasinsulationco.com": ["7729", "1411"],
  "andro@atlasinsulationco.com": ["7729", "1411"],
  "mannysource01@gmail.com": ["7729"],
  "keith@spiralstairsofamerica.com": ["7729"],
  "sales@spiralstairsofamerica.com": ["7729"],
  "sales@insulationmasters.com": ["7729", "1090", "1411"],
  "nzapata@15lightyears.com": ["7729", "Ingraham", "1411"],
  "tslavin@usiinc.com": ["7729"],
  "sales@doodie-calls.com": ["7729", "1090", "Ingraham", "1411"],
  "aewhich@gmail.com": ["1090"],
  "cody@pelicansinks.com": ["1090"],
  "contractor.sales@finedesignbuilders.com": ["1090"],
  "mary@fastaerial.com": ["1090"],
  "peterprodr@gmail.com": ["1090", "Ingraham"],
  "mario@dadewrecking.com": ["Ingraham"],
  "earlhagoodinc@gmail.com": ["Ingraham"],
  "ceo@miamipowercompany.com": ["Ingraham", "1411"],
  "cmaury@ajfroofingfl.com": ["Ingraham"],
  "uwplumbing@gmail.com": ["Ingraham"],
  "ljpropertygroupfl@gmail.com": ["Ingraham"],
  "bycodeplumbingllc@gmail.com": ["Ingraham", "1411"],
  "ourteambcc@gmail.com": ["Ingraham", "1411"],
  "jjvservicesllc@gmail.com": ["Ingraham"],
  "pablob@jjvelectricalservices.com": ["Ingraham"],
  "baromaikol43@gmail.com": ["1411"],
  "acorcoz@alliancegcusa.com": ["1411"],
  "lazaro@venextair.com": ["1411", "7729"],
  "howard@broten.com": ["1411"],
  "hector.gonzalez@campanyroofing.com": ["1411"],
  "faglaz82@gmail.com": ["1411"],
  "luisp@onairus.com": ["1411", "1698"],
  "unitedelectricalcontractor@hotmail.com": ["1411"],
  "undercontrolair@gmail.com": ["1411"],
  "estimating@undercontrolac.com": ["1411"],
  "2brosplumbingllc@gmail.com": ["1411"],
  "rramirez@solardynamics.com": ["1411"],
  "jessica@evansroof.com": ["1411"],
  "actionsod@actionsod.com": ["1411"],
  "romay@actionsod.com": ["1411"],
  "sales@customdoors.com": ["1411"],
  "coldtimemiami@gmail.com": ["1411"],
};

// Name-based fallback (normalize to lowercase)
const NAME_MAP: Record<string, string[]> = {
  "2uomo holdings llc": ["7729"],
  "alpha cabinetry & doors": ["7729"],
  "america statewide electrical contractor inc": ["7729"],
  "gig windows": ["7729"],
  "gig stock": ["7729"],
  "onair, inc.": ["7729", "1411", "1698"],
  "klen space inc": ["7729", "1090", "Ingraham"],
  "klēn space, inc.": ["7729", "1090", "Ingraham"],
  "klēn space contracts": ["7729", "1090", "Ingraham"],
  "efi propainting": ["7729"],
  "cruz electrical": ["7729"],
  "awnings by valrose": ["7729"],
  "lifesafety management": ["7729", "1090"],
  "eco permit pros": ["7729", "1090"],
  "florida hvac contractors inc.": ["7729", "Ingraham"],
  "florida hvac contractor": ["7729", "Ingraham"],
  "aa glass and windows inc": ["7729"],
  "aa glass and windows": ["7729"],
  "nova design builders": ["7729", "Ingraham"],
  "nova design builders llc": ["7729", "Ingraham"],
  "atlas insulation llc.": ["7729", "1411"],
  "manny source electric corp": ["7729"],
  "spiral stairs of america": ["7729"],
  "innovative metal craft": ["7729"],
  "insulation masters": ["7729", "1090", "1411"],
  "professional insulation": ["7729"],
  "usi inc.": ["7729"],
  "doodie calls": ["7729", "1090", "Ingraham", "1411"],
  "fine design roofing, windows and doors": ["1090"],
  "fast aerial": ["1090"],
  "miami power company": ["Ingraham", "1411"],
  "underworld plumbing": ["Ingraham"],
  "by code plumbing llc": ["Ingraham", "1411"],
  "broward county concrete": ["Ingraham", "1411"],
  "jjv services llc": ["Ingraham"],
  "broten garage door sales": ["1411"],
  "facades and glazing": ["1411"],
  "united electric contractors": ["1411"],
  "under control air conditioning": ["1411"],
  "evans roofing": ["1411"],
  "action sales": ["1411"],
};

const PROJECT_LABEL: Record<string, string> = {
  "7729": "7729 Carlyle",
  "1090": "1090 NW 54",
  "Ingraham": "Ingraham",
  "1411": "1411 Biscayne",
  "1698": "1698 Tigertail",
};

function extractEmail(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).toLowerCase().trim();
}

function lookup(email: string | null, name: string): string[] | null {
  const e = extractEmail(email);
  if (e && EMAIL_MAP[e]) return EMAIL_MAP[e];
  return NAME_MAP[name.toLowerCase().trim()] ?? null;
}

type NotesData = { t?: string[]; d?: { c: string; n: string }[]; src?: string };
function parseNotes(raw: string | null): NotesData {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return { t: p };
    if (p && typeof p === "object") return p as NotesData;
  } catch {}
  // plain text — keep as-is but don't crash
  return {};
}

async function main() {
  const subs = await prisma.subContractor.findMany({ where: { companyId: COMPANY_ID } });
  let tagged = 0, manual = 0;

  for (const sub of subs) {
    const projects = lookup(sub.email, sub.name);
    const srcValue = projects
      ? "Email " + projects.map(p => PROJECT_LABEL[p] ?? p).join(", ")
      : "Manual";

    const nd = parseNotes(sub.notes);
    nd.src = srcValue;
    const newNotes = JSON.stringify(nd);

    await prisma.subContractor.update({ where: { id: sub.id }, data: { notes: newNotes } });
    if (projects) { console.log(`✓ ${sub.name} → ${srcValue}`); tagged++; }
    else manual++;
  }
  console.log(`\nDone. ${tagged} tagged with PlanHub source, ${manual} set to Manual.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

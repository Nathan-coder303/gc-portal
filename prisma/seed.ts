import "dotenv/config";
import { PrismaClient, Role, AccountType, TaskStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { addDays } from "date-fns";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clean up existing data that will be re-seeded
  await prisma.journalLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.task.deleteMany({});

  // Company
  const company = await prisma.company.upsert({
    where: { slug: "acme-gc" },
    update: {},
    create: { name: "Acme General Contracting", slug: "acme-gc" },
  });

  // Project
  const project = await prisma.project.upsert({
    where: { id: "proj-001" },
    update: {},
    create: {
      id: "proj-001",
      companyId: company.id,
      name: "Riverside Office Build",
      code: "ROB-2026",
      startDate: new Date("2026-01-06"),
      budget: 500000,
      status: "ACTIVE",
    },
  });

  // Users
  const adminHash = await bcrypt.hash("password", 10);
  const admin = await prisma.user.upsert({
    where: { email: "mike@example.com" },
    update: {},
    create: {
      companyId: company.id,
      email: "mike@example.com",
      name: "Mike Ross",
      role: Role.ADMIN,
      passwordHash: adminHash,
    },
  });
  await prisma.user.upsert({
    where: { email: "pm@example.com" },
    update: {},
    create: {
      companyId: company.id,
      email: "pm@example.com",
      name: "Sarah Chen",
      role: Role.PM,
      passwordHash: await bcrypt.hash("password", 10),
    },
  });
  await prisma.user.upsert({
    where: { email: "partner@example.com" },
    update: {},
    create: {
      companyId: company.id,
      email: "partner@example.com",
      name: "Partner User",
      role: Role.PARTNER,
      passwordHash: await bcrypt.hash("password", 10),
    },
  });

  // Cost Codes
  const costCodes = await Promise.all([
    prisma.costCode.upsert({
      where: { projectId_code: { projectId: project.id, code: "01-EXCAV" } },
      update: {},
      create: { projectId: project.id, code: "01-EXCAV", name: "Excavation", budgetAmount: 45000 },
    }),
    prisma.costCode.upsert({
      where: { projectId_code: { projectId: project.id, code: "02-FOUND" } },
      update: {},
      create: { projectId: project.id, code: "02-FOUND", name: "Foundation", budgetAmount: 80000 },
    }),
    prisma.costCode.upsert({
      where: { projectId_code: { projectId: project.id, code: "03-FRAME" } },
      update: {},
      create: { projectId: project.id, code: "03-FRAME", name: "Framing", budgetAmount: 120000 },
    }),
    prisma.costCode.upsert({
      where: { projectId_code: { projectId: project.id, code: "04-ELEC" } },
      update: {},
      create: { projectId: project.id, code: "04-ELEC", name: "Electrical", budgetAmount: 55000 },
    }),
  ]);

  const [ccExcav, ccFound, ccFrame, ccElec] = costCodes;

  // Partners
  const alice = await prisma.partner.upsert({
    where: { id: "partner-alice" },
    update: {},
    create: { id: "partner-alice", companyId: company.id, name: "Alice Johnson", email: "alice@example.com" },
  });
  const bob = await prisma.partner.upsert({
    where: { id: "partner-bob" },
    update: {},
    create: { id: "partner-bob", companyId: company.id, name: "Bob Williams", email: "bob@example.com" },
  });

  // Accounts
  const cashAccount = await prisma.account.upsert({
    where: { id: "acct-cash" },
    update: {},
    create: { id: "acct-cash", projectId: project.id, name: "Cash", type: AccountType.ASSET, isPartnerCapital: false },
  });
  const partnerCapital = await prisma.account.upsert({
    where: { id: "acct-pcap" },
    update: {},
    create: { id: "acct-pcap", projectId: project.id, name: "Partner Capital", type: AccountType.EQUITY, isPartnerCapital: true },
  });
  const projectExpenses = await prisma.account.upsert({
    where: { id: "acct-exp" },
    update: {},
    create: { id: "acct-exp", projectId: project.id, name: "Project Expenses", type: AccountType.EXPENSE, isPartnerCapital: false },
  });
  const ownerDraws = await prisma.account.upsert({
    where: { id: "acct-draws" },
    update: {},
    create: { id: "acct-draws", projectId: project.id, name: "Owner Draws", type: AccountType.EQUITY, isPartnerCapital: false },
  });

  // Expenses - 30 across 2 weeks
  const expenseData = [
    { date: "2026-01-06", vendor: "Cat Rentals", description: "Excavator rental day 1", costCodeId: ccExcav.id, category: "Equipment", amount: 850, paidBy: "Mike Ross", paymentMethod: "Credit Card" },
    { date: "2026-01-06", vendor: "Home Depot", description: "Safety equipment", costCodeId: ccExcav.id, category: "Materials", amount: 320, paidBy: "Mike Ross", paymentMethod: "Credit Card" },
    { date: "2026-01-07", vendor: "Cat Rentals", description: "Excavator rental day 2", costCodeId: ccExcav.id, category: "Equipment", amount: 850, paidBy: "Mike Ross", paymentMethod: "Credit Card" },
    { date: "2026-01-07", vendor: "Sunbelt Rentals", description: "Compactor rental", costCodeId: ccExcav.id, category: "Equipment", amount: 420, paidBy: "Sarah Chen", paymentMethod: "Check" },
    { date: "2026-01-08", vendor: "Cat Rentals", description: "Excavator rental day 3", costCodeId: ccExcav.id, category: "Equipment", amount: 850, paidBy: "Mike Ross", paymentMethod: "Credit Card" },
    { date: "2026-01-08", vendor: "Fastenal", description: "Anchor bolts and hardware", costCodeId: ccFound.id, category: "Materials", amount: 1240, paidBy: "Sarah Chen", paymentMethod: "Check" },
    { date: "2026-01-09", vendor: "Ready Mix Co", description: "Concrete pour footings", costCodeId: ccFound.id, category: "Materials", amount: 4800, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-09", vendor: "Labor Force LLC", description: "Foundation crew day 1", costCodeId: ccFound.id, category: "Labor", amount: 2400, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-10", vendor: "Labor Force LLC", description: "Foundation crew day 2", costCodeId: ccFound.id, category: "Labor", amount: 2400, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-10", vendor: "Home Depot", description: "Rebar and tie wire", costCodeId: ccFound.id, category: "Materials", amount: 2100, paidBy: "Sarah Chen", paymentMethod: "Credit Card" },
    { date: "2026-01-12", vendor: "Pacific Lumber", description: "Framing lumber package", costCodeId: ccFrame.id, category: "Materials", amount: 18500, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-12", vendor: "Home Depot", description: "Lumber 2x4 studs", costCodeId: ccFrame.id, category: "Materials", amount: 1250, paidBy: "Mike Ross", paymentMethod: "Credit Card" },
    { date: "2026-01-12", vendor: "Fastenal", description: "Framing nails and hardware", costCodeId: ccFrame.id, category: "Materials", amount: 680, paidBy: "Sarah Chen", paymentMethod: "Check" },
    { date: "2026-01-13", vendor: "Framing Crew Inc", description: "Framing crew day 1", costCodeId: ccFrame.id, category: "Labor", amount: 3200, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-13", vendor: "Framing Crew Inc", description: "Framing crew day 2", costCodeId: ccFrame.id, category: "Labor", amount: 3200, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-14", vendor: "Home Depot", description: "OSB sheathing", costCodeId: ccFrame.id, category: "Materials", amount: 3400, paidBy: "Sarah Chen", paymentMethod: "Credit Card" },
    { date: "2026-01-14", vendor: "Framing Crew Inc", description: "Framing crew day 3", costCodeId: ccFrame.id, category: "Labor", amount: 3200, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-15", vendor: "Home Depot", description: "Lumber 2x4 studs", costCodeId: ccFrame.id, category: "Materials", amount: 1250, paidBy: "Mike Ross", paymentMethod: "Credit Card" }, // DUPLICATE
    { date: "2026-01-15", vendor: "Pacific Lumber", description: "Engineered lumber beams", costCodeId: ccFrame.id, category: "Materials", amount: 5600, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-15", vendor: "Framing Crew Inc", description: "Framing crew day 4", costCodeId: ccFrame.id, category: "Labor", amount: 3200, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-16", vendor: "Sparky Electric", description: "Electrical rough-in day 1", costCodeId: ccElec.id, category: "Labor", amount: 2800, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-16", vendor: "Graybar Electric", description: "Wire and conduit", costCodeId: ccElec.id, category: "Materials", amount: 4200, paidBy: "Sarah Chen", paymentMethod: "Check" },
    { date: "2026-01-17", vendor: "Sparky Electric", description: "Electrical rough-in day 2", costCodeId: ccElec.id, category: "Labor", amount: 2800, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-17", vendor: "Graybar Electric", description: "Panel and breakers", costCodeId: ccElec.id, category: "Materials", amount: 3100, paidBy: "Mike Ross", paymentMethod: "Credit Card" },
    { date: "2026-01-19", vendor: "Home Depot", description: "Miscellaneous supplies", costCodeId: ccFrame.id, category: "Materials", amount: 540, paidBy: "Sarah Chen", paymentMethod: "Credit Card" },
    { date: "2026-01-19", vendor: "Labor Force LLC", description: "General labor cleanup", costCodeId: ccFrame.id, category: "Labor", amount: 960, paidBy: "Mike Ross", paymentMethod: "Check" },
    { date: "2026-01-19", vendor: "Cat Rentals", description: "Scissor lift rental", costCodeId: ccFrame.id, category: "Equipment", amount: 620, paidBy: "Mike Ross", paymentMethod: "Credit Card" },
    { date: "2026-01-20", vendor: "Sparky Electric", description: "Electrical rough-in day 3", costCodeId: ccElec.id, category: "Labor", amount: 2800, paidBy: "Mike Ross", paymentMethod: "ACH" },
    { date: "2026-01-20", vendor: "Ready Mix Co", description: "Concrete slab pour", costCodeId: ccFound.id, category: "Materials", amount: 4800, paidBy: "Mike Ross", paymentMethod: "ACH" }, // DUPLICATE (same vendor+amount)
    { date: "2026-01-20", vendor: "Fastenal", description: "Anchor bolts restocking", costCodeId: ccFound.id, category: "Materials", amount: 380, paidBy: "Sarah Chen", paymentMethod: "Check" },
    // Second deliberate duplicate: same as row above (same vendor+amount+date)
    { date: "2026-01-20", vendor: "Fastenal", description: "Anchor bolts restocking (dup)", costCodeId: ccFound.id, category: "Materials", amount: 380, paidBy: "Sarah Chen", paymentMethod: "Check" },
  ];

  // Track duplicates
  const seen = new Map<string, boolean>();
  for (const e of expenseData) {
    const key = `${e.vendor}|${e.amount}|${e.date}`;
    const isDuplicate = seen.has(key);
    seen.set(key, true);
    await prisma.expense.create({
      data: {
        projectId: project.id,
        companyId: company.id,
        date: new Date(e.date),
        vendor: e.vendor,
        description: e.description,
        costCodeId: e.costCodeId,
        category: e.category,
        amount: e.amount,
        tax: 0,
        paymentMethod: e.paymentMethod,
        paidBy: e.paidBy,
        isDuplicate,
        createdBy: admin.id,
      },
    });
  }

  // Tasks
  const taskData = [
    { phase: "Foundation", name: "Excavation", durationDays: 3, predecessors: [], trade: "Excavation", assignee: "Crew A", isMilestone: false, startOffset: 0 },
    { phase: "Foundation", name: "Pour Footings", durationDays: 2, predecessors: ["Excavation"], trade: "Concrete", assignee: "Crew B", isMilestone: false, startOffset: 3 },
    { phase: "Foundation", name: "Cure Period", durationDays: 7, predecessors: ["Pour Footings"], trade: "", assignee: "", isMilestone: false, startOffset: 5 },
    { phase: "Foundation", name: "Foundation Inspection", durationDays: 0, predecessors: ["Cure Period"], trade: "", assignee: "", isMilestone: true, startOffset: 12 },
    { phase: "Framing", name: "Frame Walls", durationDays: 5, predecessors: ["Foundation Inspection"], trade: "Framing", assignee: "Framing Crew", isMilestone: false, startOffset: 12 },
    { phase: "Framing", name: "Roof Structure", durationDays: 4, predecessors: ["Frame Walls"], trade: "Framing", assignee: "Framing Crew", isMilestone: false, startOffset: 17 },
    { phase: "Framing", name: "Sheathing", durationDays: 3, predecessors: ["Roof Structure"], trade: "Framing", assignee: "Framing Crew", isMilestone: false, startOffset: 21 },
    { phase: "Framing", name: "Framing Inspection", durationDays: 0, predecessors: ["Sheathing"], trade: "", assignee: "", isMilestone: true, startOffset: 24 },
    { phase: "Electrical", name: "Rough-in Wiring", durationDays: 5, predecessors: ["Framing Inspection"], trade: "Electrical", assignee: "Sparky Electric", isMilestone: false, startOffset: 24 },
    { phase: "Electrical", name: "Panel Installation", durationDays: 2, predecessors: ["Rough-in Wiring"], trade: "Electrical", assignee: "Sparky Electric", isMilestone: false, startOffset: 29 },
    { phase: "Electrical", name: "Electrical Inspection", durationDays: 0, predecessors: ["Panel Installation"], trade: "", assignee: "", isMilestone: true, startOffset: 31 },
    { phase: "Electrical", name: "Trim-out", durationDays: 3, predecessors: ["Electrical Inspection"], trade: "Electrical", assignee: "Sparky Electric", isMilestone: false, startOffset: 31 },
  ];

  const projectStart = new Date("2026-01-06");
  const taskMap = new Map<string, string>();

  for (const t of taskData) {
    const startDate = addDays(projectStart, t.startOffset);
    const endDate = t.isMilestone ? startDate : addDays(startDate, t.durationDays - 1);
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        phase: t.phase,
        name: t.name,
        durationDays: t.durationDays,
        startDate,
        endDate,
        predecessorIds: [],
        trade: t.trade,
        assignee: t.assignee,
        isMilestone: t.isMilestone,
        status: TaskStatus.NOT_STARTED,
        percentComplete: 0,
        createdBy: admin.id,
      },
    });
    taskMap.set(t.name, task.id);
  }

  // Update predecessor IDs
  for (const t of taskData) {
    if (t.predecessors.length > 0) {
      const predecessorIds = t.predecessors.map((p) => taskMap.get(p)!).filter(Boolean);
      const taskId = taskMap.get(t.name)!;
      await prisma.task.update({
        where: { id: taskId },
        data: { predecessorIds },
      });
    }
  }

  // Journal Entries - 2 contributions, 3 draws
  const entries = [
    {
      date: "2026-01-06",
      memo: "Partner contribution - Alice Johnson (40%)",
      reference: "JE-001",
      lines: [
        { accountId: cashAccount.id, partnerId: null, debit: 100000, credit: 0 },
        { accountId: partnerCapital.id, partnerId: alice.id, debit: 0, credit: 100000 },
      ],
    },
    {
      date: "2026-01-06",
      memo: "Partner contribution - Bob Williams (60%)",
      reference: "JE-002",
      lines: [
        { accountId: cashAccount.id, partnerId: null, debit: 150000, credit: 0 },
        { accountId: partnerCapital.id, partnerId: bob.id, debit: 0, credit: 150000 },
      ],
    },
    {
      date: "2026-01-09",
      memo: "Draw - concrete and foundation materials",
      reference: "JE-003",
      lines: [
        { accountId: ownerDraws.id, partnerId: null, debit: 12000, credit: 0 },
        { accountId: cashAccount.id, partnerId: null, debit: 0, credit: 12000 },
      ],
    },
    {
      date: "2026-01-14",
      memo: "Draw - framing materials and labor week 1",
      reference: "JE-004",
      lines: [
        { accountId: ownerDraws.id, partnerId: null, debit: 28500, credit: 0 },
        { accountId: cashAccount.id, partnerId: null, debit: 0, credit: 28500 },
      ],
    },
    {
      date: "2026-01-20",
      memo: "Draw - electrical rough-in",
      reference: "JE-005",
      lines: [
        { accountId: ownerDraws.id, partnerId: null, debit: 15200, credit: 0 },
        { accountId: cashAccount.id, partnerId: null, debit: 0, credit: 15200 },
      ],
    },
  ];

  for (const entry of entries) {
    await prisma.journalEntry.create({
      data: {
        projectId: project.id,
        date: new Date(entry.date),
        memo: entry.memo,
        reference: entry.reference,
        createdBy: admin.id,
        lines: {
          create: entry.lines,
        },
      },
    });
  }

  // ─── Estimate Template: Addition ─────────────────────────────────────────────
  const existingTemplate = await prisma.estimateTemplate.findFirst({
    where: { companyId: company.id, name: "Addition" },
  });

  if (!existingTemplate) {
    const additionTemplate = await prisma.estimateTemplate.create({
      data: {
        companyId: company.id,
        name: "Addition",
        description: "Standard CSI MasterFormat template for residential additions",
        sortOrder: 0,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    const divisionData = [
      {
        csiCode: "01", name: "General Requirements", sortOrder: 0,
        groups: [
          {
            name: "Supervision", sortOrder: 0,
            items: [
              { name: "Site Superintendent", unit: "LS", sortOrder: 0 },
              { name: "Safety Officer", unit: "LS", sortOrder: 1 },
              { name: "PM / Admin", unit: "LS", sortOrder: 2 },
            ],
          },
          {
            name: "Temporary Facilities", sortOrder: 1,
            items: [
              { name: "Temporary Power", unit: "LS", sortOrder: 0 },
              { name: "Portable Toilets", unit: "MO", sortOrder: 1 },
              { name: "Dumpster (2 Pulls)", unit: "EA", sortOrder: 2 },
              { name: "Site Fencing", unit: "LF", sortOrder: 3 },
            ],
          },
        ],
      },
      {
        csiCode: "03", name: "Concrete", sortOrder: 1,
        groups: [
          {
            name: "Foundation", sortOrder: 0,
            items: [
              { name: "Excavation", unit: "CY", sortOrder: 0 },
              { name: "Footings & Foundation Walls", unit: "CY", sortOrder: 1 },
              { name: "Slab On Grade", unit: "SF", sortOrder: 2 },
            ],
          },
          {
            name: "Flatwork", sortOrder: 1,
            items: [
              { name: "Concrete Steps", unit: "LS", sortOrder: 0 },
              { name: "Concrete Patio / Apron", unit: "SF", sortOrder: 1 },
            ],
          },
        ],
      },
      {
        csiCode: "06", name: "Wood & Plastics", sortOrder: 2,
        groups: [
          {
            name: "Rough Framing", sortOrder: 0,
            items: [
              { name: "Framing Labor & Material", unit: "SF", sortOrder: 0 },
              { name: "Structural Beams / Headers", unit: "LF", sortOrder: 1 },
              { name: "Exterior Sheathing", unit: "SF", sortOrder: 2 },
              { name: "Hurricane Straps & Hardware", unit: "LS", sortOrder: 3 },
            ],
          },
          {
            name: "Exterior Trim & Millwork", sortOrder: 1,
            items: [
              { name: "Fascia / Soffit", unit: "LF", sortOrder: 0 },
              { name: "Corner Boards", unit: "LF", sortOrder: 1 },
              { name: "Trim Boards", unit: "LF", sortOrder: 2 },
            ],
          },
          {
            name: "Interior Trim & Millwork", sortOrder: 2,
            items: [
              { name: "Interior Door Casings", unit: "EA", sortOrder: 0 },
              { name: "Base Molding", unit: "LF", sortOrder: 1 },
              { name: "Window Stools & Aprons", unit: "EA", sortOrder: 2 },
              { name: "Crown Molding (optional)", unit: "LF", sortOrder: 3 },
            ],
          },
          {
            name: "Rough Carpentry - Misc", sortOrder: 3,
            items: [
              { name: "Blocking", unit: "LS", sortOrder: 0 },
              { name: "Misc Framing Hardware", unit: "LS", sortOrder: 1 },
            ],
          },
        ],
      },
      {
        csiCode: "07", name: "Thermal & Moisture Protection", sortOrder: 3,
        groups: [
          {
            name: "Roofing", sortOrder: 0,
            items: [
              { name: "Shingle Roofing (tear-off + install)", unit: "SQ", sortOrder: 0 },
              { name: "Underlayment & Ice Shield", unit: "SQ", sortOrder: 1 },
              { name: "Ridge Vent", unit: "LF", sortOrder: 2 },
            ],
          },
          {
            name: "Insulation", sortOrder: 1,
            items: [
              { name: "Batt Insulation (walls / ceiling)", unit: "SF", sortOrder: 0 },
              { name: "Spray Foam (rim joist / transitions)", unit: "BF", sortOrder: 1 },
            ],
          },
          {
            name: "Waterproofing & Sealants", sortOrder: 2,
            items: [
              { name: "Flashing (step, counter, base)", unit: "LF", sortOrder: 0 },
              { name: "Caulking & Sealants", unit: "LS", sortOrder: 1 },
            ],
          },
        ],
      },
      {
        csiCode: "08", name: "Openings", sortOrder: 4,
        groups: [
          {
            name: "Doors & Frames", sortOrder: 0,
            items: [
              { name: "Exterior Entry Door & Hardware", unit: "EA", sortOrder: 0 },
              { name: "Interior Doors & Hardware", unit: "EA", sortOrder: 1 },
              { name: "Exterior Door Frames", unit: "EA", sortOrder: 2 },
            ],
          },
          {
            name: "Windows", sortOrder: 1,
            items: [
              { name: "Windows (installed)", unit: "EA", sortOrder: 0 },
              { name: "Window Screens & Accessories", unit: "LS", sortOrder: 1 },
            ],
          },
        ],
      },
      {
        csiCode: "09", name: "Finishes", sortOrder: 5,
        groups: [
          {
            name: "Drywall", sortOrder: 0,
            items: [
              { name: "Drywall Hang & Finish (Level 4)", unit: "SF", sortOrder: 0 },
              { name: "Blueboard & Skim Coat (optional)", unit: "SF", sortOrder: 1 },
            ],
          },
          {
            name: "Tile", sortOrder: 1,
            items: [
              { name: "Bathroom Tile (floor / wall)", unit: "SF", sortOrder: 0 },
              { name: "Kitchen Backsplash", unit: "SF", sortOrder: 1 },
            ],
          },
          {
            name: "Flooring", sortOrder: 2,
            items: [
              { name: "Hardwood (install + sand + finish)", unit: "SF", sortOrder: 0 },
              { name: "Engineered Hardwood", unit: "SF", sortOrder: 1 },
              { name: "LVP / LVT", unit: "SF", sortOrder: 2 },
              { name: "Carpet", unit: "SY", sortOrder: 3 },
            ],
          },
          {
            name: "Painting", sortOrder: 3,
            items: [
              { name: "Interior Paint (walls / ceilings / trim)", unit: "SF", sortOrder: 0 },
              { name: "Exterior Paint / Stain", unit: "SF", sortOrder: 1 },
              { name: "Primer Coat", unit: "SF", sortOrder: 2 },
            ],
          },
        ],
      },
      {
        csiCode: "10", name: "Specialties", sortOrder: 6,
        groups: [
          {
            name: "Misc. Specialties", sortOrder: 0,
            items: [
              { name: "Bathroom Accessories (TP holder, towel bars)", unit: "LS", sortOrder: 0 },
              { name: "Medicine Cabinet", unit: "EA", sortOrder: 1 },
              { name: "Mirrors", unit: "EA", sortOrder: 2 },
            ],
          },
        ],
      },
      {
        csiCode: "11", name: "Equipment", sortOrder: 7,
        groups: [],
      },
      {
        csiCode: "15", name: "Mechanical", sortOrder: 8,
        groups: [
          {
            name: "Plumbing", sortOrder: 0,
            items: [
              { name: "Rough Plumbing", unit: "LS", sortOrder: 0 },
              { name: "Finish Plumbing (fixtures)", unit: "LS", sortOrder: 1 },
              { name: "Water Heater", unit: "EA", sortOrder: 2 },
            ],
          },
          {
            name: "HVAC", sortOrder: 1,
            items: [
              { name: "HVAC Equipment & Install", unit: "LS", sortOrder: 0 },
              { name: "Ductwork & Registers", unit: "LS", sortOrder: 1 },
              { name: "Thermostat", unit: "EA", sortOrder: 2 },
            ],
          },
        ],
      },
      {
        csiCode: "16", name: "Electrical", sortOrder: 9,
        groups: [
          {
            name: "Rough Electrical", sortOrder: 0,
            items: [
              { name: "Electrical Panel Upgrade", unit: "EA", sortOrder: 0 },
              { name: "Rough Wiring & Boxes", unit: "LS", sortOrder: 1 },
            ],
          },
          {
            name: "Finish Electrical", sortOrder: 1,
            items: [
              { name: "Devices & Cover Plates", unit: "LS", sortOrder: 0 },
              { name: "Fixtures & Lighting", unit: "LS", sortOrder: 1 },
              { name: "Ceiling Fans", unit: "EA", sortOrder: 2 },
            ],
          },
        ],
      },
    ];

    for (const divData of divisionData) {
      const division = await prisma.estimateTemplateDivision.create({
        data: {
          templateId: additionTemplate.id,
          csiCode: divData.csiCode,
          name: divData.name,
          sortOrder: divData.sortOrder,
        },
      });

      for (const grpData of divData.groups) {
        const group = await prisma.estimateTemplateGroup.create({
          data: {
            divisionId: division.id,
            name: grpData.name,
            sortOrder: grpData.sortOrder,
          },
        });

        for (const itemData of grpData.items) {
          await prisma.estimateTemplateItem.create({
            data: {
              divisionId: division.id,
              groupId: group.id,
              name: itemData.name,
              unit: itemData.unit,
              sortOrder: itemData.sortOrder,
            },
          });
        }
      }
    }

    console.log(`Addition template created with ${divisionData.length} divisions`);
  }

  console.log("Seed complete!");
  console.log(`Company: ${company.slug} (id: ${company.id})`);
  console.log(`Project: ${project.id}`);
  console.log(`Login: mike@example.com / password`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

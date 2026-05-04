import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });

const COMPANY_ID = "cmmij161r000004jm8il8bd0e";
const FLAT_TEMPLATE_ID = "cmn3np1xc000004jytwyuf3pz";

async function main() {
  // Get admin user for company
  const adminUser = await prisma.user.findFirst({
    where: { companyId: COMPANY_ID, role: "ADMIN" },
  });
  if (!adminUser) throw new Error("No admin user found for company");
  const createdBy = adminUser.id;
  console.log(`Using user: ${adminUser.email} (${createdBy})`);

  // Fetch the "Flat Roof (Hot Mop)" template groups and items
  const flatTemplate = await prisma.estimateTemplate.findUnique({
    where: { id: FLAT_TEMPLATE_ID },
    include: {
      divisions: {
        include: {
          groups: {
            include: { items: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!flatTemplate) throw new Error("Flat Roof (Hot Mop) template not found");

  const roofingDiv = flatTemplate.divisions.find((d) => d.name === "Roofing System");
  if (!roofingDiv) throw new Error("Roofing System division not found");

  const underlaymentGroup = roofingDiv.groups.find((g) => g.name === "Underlayment & Decking");
  const shinglesGroup = roofingDiv.groups.find((g) => g.name === "Shingles");

  if (!underlaymentGroup) throw new Error("Underlayment & Decking group not found");
  if (!shinglesGroup) throw new Error("Shingles group not found");

  console.log(`Flat items: ${underlaymentGroup.items.length}, Shingles items: ${shinglesGroup.items.length}`);

  // Get highest sortOrder for templates in this company
  const lastTemplate = await prisma.estimateTemplate.findFirst({
    where: { companyId: COMPANY_ID },
    orderBy: { sortOrder: "desc" },
  });
  const nextSortOrder = (lastTemplate?.sortOrder ?? 0) + 1;

  // Create the new template
  const newTemplate = await prisma.estimateTemplate.create({
    data: {
      companyId: COMPANY_ID,
      name: "Flat + Shingles",
      type: "TEMPLATE",
      sortOrder: nextSortOrder,
      createdBy,
    },
  });
  console.log(`Created template: ${newTemplate.name} (${newTemplate.id})`);

  // Create the Roofing System division
  const newDiv = await prisma.estimateTemplateDivision.create({
    data: {
      templateId: newTemplate.id,
      name: "Roofing System",
      sortOrder: 0,
    },
  });
  console.log(`Created division: ${newDiv.name} (${newDiv.id})`);

  // Create Group 1: "Flat" — items from Underlayment & Decking
  const flatGroup = await prisma.estimateTemplateGroup.create({
    data: {
      divisionId: newDiv.id,
      name: "Flat",
      sortOrder: 0,
    },
  });
  console.log(`Created group: ${flatGroup.name} (${flatGroup.id})`);

  for (let i = 0; i < underlaymentGroup.items.length; i++) {
    const src = underlaymentGroup.items[i];
    await prisma.estimateTemplateItem.create({
      data: {
        groupId: flatGroup.id,
        divisionId: newDiv.id,
        name: src.name,
        unit: src.unit ?? null,
        defaultQty: src.defaultQty ?? null,
        defaultUnitCost: src.defaultUnitCost ?? null,
        defaultLaborCost: src.defaultLaborCost ?? null,
        defaultMaterialCost: src.defaultMaterialCost ?? null,
        notes: src.notes ?? null,
        sortOrder: i,
      },
    });
  }
  console.log(`Copied ${underlaymentGroup.items.length} items into "Flat" group`);

  // Create Group 2: "Shingles"
  const newShinglesGroup = await prisma.estimateTemplateGroup.create({
    data: {
      divisionId: newDiv.id,
      name: "Shingles",
      sortOrder: 1,
    },
  });
  console.log(`Created group: ${newShinglesGroup.name} (${newShinglesGroup.id})`);

  for (let i = 0; i < shinglesGroup.items.length; i++) {
    const src = shinglesGroup.items[i];
    await prisma.estimateTemplateItem.create({
      data: {
        groupId: newShinglesGroup.id,
        divisionId: newDiv.id,
        name: src.name,
        unit: src.unit ?? null,
        defaultQty: src.defaultQty ?? null,
        defaultUnitCost: src.defaultUnitCost ?? null,
        defaultLaborCost: src.defaultLaborCost ?? null,
        defaultMaterialCost: src.defaultMaterialCost ?? null,
        notes: src.notes ?? null,
        sortOrder: i,
      },
    });
  }
  console.log(`Copied ${shinglesGroup.items.length} items into "Shingles" group`);

  console.log("\nDone! Template 'Flat + Shingles' created successfully.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

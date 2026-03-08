"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

const SignupSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  email:       z.string().email("Invalid email"),
  password:    z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(1, "Company name is required"),
});

export async function signUp(formData: FormData) {
  const data = SignupSchema.parse({
    name:        formData.get("name"),
    email:       formData.get("email"),
    password:    formData.get("password"),
    companyName: formData.get("companyName"),
  });

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("An account with that email already exists");

  const slug = data.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) + "-" + Date.now().toString(36);

  const company = await prisma.company.create({
    data: { name: data.companyName, slug },
  });

  const passwordHash = await bcrypt.hash(data.password, 12);

  await prisma.user.create({
    data: {
      companyId:    company.id,
      name:         data.name,
      email:        data.email,
      passwordHash,
      role:         "ADMIN",
      updatedBy:    "signup",
    },
  });

  redirect("/login?registered=1");
}

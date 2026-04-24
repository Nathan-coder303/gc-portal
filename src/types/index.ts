import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      companyId: string;
      lastName?: string | null;
      clientId?: string | null;
    };
  }
}

export type { Role };

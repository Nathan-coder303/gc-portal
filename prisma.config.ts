import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
    // directUrl bypasses the pgBouncer pooler for migrations (advisory locks require a direct connection)
    directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});

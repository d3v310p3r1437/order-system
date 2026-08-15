// Prisma 6.x классик generator: холболтын url-ыг schema.prisma-ийн
// `datasource db { url = env("DATABASE_URL") }`-ээр л зохицуулна
// (docs/adr/003-prisma-6-pin.md) — энд давхар зарлах шаардлагагүй.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});

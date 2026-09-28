import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export { PrismaClient } from "../generated/prisma/client.js";
export * from "../generated/prisma/enums.js";

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg(
    {
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000
    },
    { schema: "farmquest" }
  );

  return new PrismaClient({ adapter });
}

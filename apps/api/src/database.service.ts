import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  createPrismaClient,
  type PrismaClient
} from "@farmquest/database";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    this.client = createPrismaClient(connectionString);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

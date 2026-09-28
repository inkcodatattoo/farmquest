import {
  Controller,
  Get,
  ServiceUnavailableException
} from "@nestjs/common";
import { DatabaseService } from "../database.service.js";

@Controller("api/v1/health")
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    try {
      await this.db.client.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException("DATABASE_NOT_READY");
    }
  }
}

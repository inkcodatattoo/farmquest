import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { DatabaseService } from "../database.service.js";

@Controller("api/v1/health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly db: DatabaseService) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    try {
      await this.db.client.user.count();
      return { status: "ready" };
    } catch (error) {
      this.logger.error(
        "Database readiness check failed",
        error instanceof Error ? error.stack : String(error)
      );
      throw new ServiceUnavailableException("DATABASE_NOT_READY");
    }
  }
}

import { Module } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";
import { AuthService } from "./auth/auth.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { DevSessionController } from "./auth/dev-session.controller.js";
import { FarmsController } from "./farms/farms.controller.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  controllers: [
    AuthController,
    DevSessionController,
    FarmsController,
    HealthController
  ],
  providers: [DatabaseService, AuthService]
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";
import { AuthService } from "./auth/auth.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { DevSessionController } from "./auth/dev-session.controller.js";
import { EconomyController } from "./farms/economy.controller.js";
import { FarmsController } from "./farms/farms.controller.js";
import { GameplayController } from "./farms/gameplay.controller.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  controllers: [
    AuthController,
    DevSessionController,
    FarmsController,
    GameplayController,
    EconomyController,
    HealthController
  ],
  providers: [DatabaseService, AuthService]
})
export class AppModule {}

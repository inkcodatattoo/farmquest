import { Module } from "@nestjs/common";
import { AnimalController } from "./farms/animal.controller.js";
import { DatabaseService } from "./database.service.js";
import { AuthService } from "./auth/auth.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { DevSessionController } from "./auth/dev-session.controller.js";
import { FarmsController } from "./farms/farms.controller.js";
import { GameplayController } from "./farms/gameplay.controller.js";
import {
  FarmEconomyController,
  ShopCatalogController
} from "./farms/economy.controller.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  controllers: [
  AuthController,
  DevSessionController,
  FarmsController,
  GameplayController,
  FarmEconomyController,
  ShopCatalogController,
  AnimalController,
  HealthController
],
  providers: [DatabaseService, AuthService]
})
export class AppModule {}

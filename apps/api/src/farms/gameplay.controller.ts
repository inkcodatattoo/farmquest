import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UnprocessableEntityException
} from "@nestjs/common";
import type { Request } from "express";
import { PlantBody } from "@farmquest/contracts";
import {
  harvest,
  plant
} from "@farmquest/domain";
import { CryptoRandomSource } from "@farmquest/game-rules";
import { AuthService } from "../auth/auth.service.js";
import { DatabaseService } from "../database.service.js";

const random = new CryptoRandomSource();

import {
  mapDomainError,
  mutationEnvelope,
  requireIdempotencyKey
} from "../http/economic-http.js";

@Controller("api/v1/farms")
export class GameplayController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  @Post(":farmId/plant")
  async plantAll(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(req, idempotencyHeader);
    const parsed = PlantBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid planting payload",
          details: { issues: parsed.error.issues }
        }
      });
    }

    try {
      const result = await plant(this.db.client, {
        actorUserId: session.user.id,
        farmId,
        cropDefinitionId: parsed.data.cropDefinitionId,
        idempotencyKey
      });
      return mutationEnvelope(req, result);
    } catch (error) {
      mapDomainError(req, error);
    }
  }

  @Post(":farmId/plots/:plotId/plant")
  async plantPlot(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Param("plotId") plotId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(req, idempotencyHeader);
    const parsed = PlantBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid planting payload",
          details: { issues: parsed.error.issues }
        }
      });
    }

    try {
      const result = await plant(this.db.client, {
        actorUserId: session.user.id,
        farmId,
        plotId,
        cropDefinitionId: parsed.data.cropDefinitionId,
        idempotencyKey
      });
      return mutationEnvelope(req, result);
    } catch (error) {
      mapDomainError(req, error);
    }
  }

  @Post(":farmId/harvest")
  async harvestAll(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(req, idempotencyHeader);

    try {
      const result = await harvest(this.db.client, random, {
        actorUserId: session.user.id,
        farmId,
        idempotencyKey
      });
      return mutationEnvelope(req, result);
    } catch (error) {
      mapDomainError(req, error);
    }
  }

  @Post(":farmId/plots/:plotId/harvest")
  async harvestPlot(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Param("plotId") plotId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(req, idempotencyHeader);

    try {
      const result = await harvest(this.db.client, random, {
        actorUserId: session.user.id,
        farmId,
        plotId,
        idempotencyKey
      });
      return mutationEnvelope(req, result);
    } catch (error) {
      mapDomainError(req, error);
    }
  }
}

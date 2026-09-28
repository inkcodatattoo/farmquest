import { randomUUID } from "node:crypto";
import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnprocessableEntityException
} from "@nestjs/common";
import type { Request } from "express";
import {
  IdempotencyKey,
  PlantBody
} from "@farmquest/contracts";
import {
  DomainError,
  harvest,
  plant
} from "@farmquest/domain";
import { CryptoRandomSource } from "@farmquest/game-rules";
import { AuthService } from "../auth/auth.service.js";
import { DatabaseService } from "../database.service.js";

const random = new CryptoRandomSource();

function mapDomainError(error: unknown): never {
  if (!(error instanceof DomainError)) throw error;

  const payload = {
    error: {
      code: error.code,
      message: error.code,
      ...(error.details ? { details: error.details } : {})
    }
  };

  switch (error.code) {
    case "FARM_NOT_FOUND":
      throw new NotFoundException(payload);

    case "FARM_ACCESS_REMOVED":
    case "FARM_STREAMER_SUSPENDED":
    case "USER_BANNED":
      throw new ForbiddenException(payload);

    case "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD":
    case "PLOT_ALREADY_HARVESTED":
      throw new ConflictException(payload);

    default:
      throw new UnprocessableEntityException(payload);
  }
}

function requireIdempotencyKey(value: string | undefined): string {
  const parsed = IdempotencyKey.safeParse(value);
  if (!parsed.success) {
    throw new UnprocessableEntityException({
      error: {
        code: "IDEMPOTENCY_KEY_INVALID",
        message: "Idempotency-Key must contain 16 to 128 characters"
      }
    });
  }
  return parsed.data;
}

function envelope(
  req: Request,
  result: Record<string, unknown>
): Record<string, unknown> {
  const requestId = req.header("x-request-id") ?? randomUUID();
  const linearizedAt =
    typeof result.linearizedAt === "string"
      ? result.linearizedAt
      : undefined;

  const { linearizedAt: _removed, ...data } = result;

  return {
    data,
    meta: {
      requestId,
      serverTime: new Date().toISOString(),
      ...(linearizedAt ? { linearizedAt } : {})
    }
  };
}

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
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
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
      return envelope(req, result);
    } catch (error) {
      mapDomainError(error);
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
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
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
      return envelope(req, result);
    } catch (error) {
      mapDomainError(error);
    }
  }

  @Post(":farmId/harvest")
  async harvestAll(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);

    try {
      const result = await harvest(this.db.client, random, {
        actorUserId: session.user.id,
        farmId,
        idempotencyKey
      });
      return envelope(req, result);
    } catch (error) {
      mapDomainError(error);
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
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);

    try {
      const result = await harvest(this.db.client, random, {
        actorUserId: session.user.id,
        farmId,
        plotId,
        idempotencyKey
      });
      return envelope(req, result);
    } catch (error) {
      mapDomainError(error);
    }
  }
}

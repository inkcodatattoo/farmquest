import { randomUUID } from "node:crypto";
import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnprocessableEntityException
} from "@nestjs/common";
import type { Request } from "express";
import {
  DiscardBody,
  IdempotencyKey,
  QuickSellBody,
  ShopBuyBody
} from "@farmquest/contracts";
import {
  buyFromShop,
  discardInventory,
  DomainError,
  quickSell
} from "@farmquest/domain";
import { AuthService } from "../auth/auth.service.js";
import { DatabaseService } from "../database.service.js";

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
    case "SHOP_OFFER_NOT_FOUND":
      throw new NotFoundException(payload);

    case "FARM_ACCESS_REMOVED":
    case "FARM_STREAMER_SUSPENDED":
    case "USER_BANNED":
      throw new ForbiddenException(payload);

    case "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD":
      throw new ConflictException(payload);

    default:
      throw new UnprocessableEntityException(payload);
  }
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
  const { linearizedAt: _ignored, ...data } = result;

  return {
    data,
    meta: {
      requestId,
      serverTime: new Date().toISOString(),
      ...(linearizedAt ? { linearizedAt } : {})
    }
  };
}

@Controller("api/v1")
export class EconomyController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  @Get("farms/:farmId/inventory")
  async inventory(
    @Req() req: Request,
    @Param("farmId") farmId: string
  ) {
    const session = await this.auth.requireSession(req);

    const farm = await this.db.client.farm.findFirst({
      where: {
        id: farmId,
        userId: session.user.id,
        status: "ACTIVE"
      },
      select: {
        id: true,
        inventorySlots: true,
        stackLimit: true
      }
    });

    if (!farm) throw new NotFoundException("FARM_NOT_FOUND");

    const items = await this.db.client.inventoryItem.findMany({
      where: { farmId },
      include: {
        item: true,
        quality: true
      },
      orderBy: [
        { item: { category: "asc" } },
        { item: { name: "asc" } },
        { quality: { code: "asc" } }
      ]
    });

    return {
      farmId,
      inventorySlots: farm.inventorySlots,
      stackLimit: farm.stackLimit,
      items: items.map((entry) => ({
        id: entry.id,
        itemDefinitionId: entry.itemDefinitionId,
        name: entry.item.name,
        category: entry.item.category,
        quality: entry.quality.code,
        quantity: entry.quantity.toString(),
        reservedQuantity: entry.reservedQuantity.toString(),
        npcSellable:
          entry.item.npcSellable && entry.quality.code !== "ROTTEN",
        discardable: entry.item.discardable
      }))
    };
  }

  @Get("shop")
  async shop(
    @Req() req: Request,
    @Query("farmId") farmId: string
  ) {
    const session = await this.auth.requireSession(req);

    const farm = await this.db.client.farm.findFirst({
      where: {
        id: farmId,
        userId: session.user.id,
        status: "ACTIVE"
      },
      select: {
        id: true,
        level: true
      }
    });

    if (!farm) throw new NotFoundException("FARM_NOT_FOUND");

    const offers = await this.db.client.shopOffer.findMany({
      where: {
        enabled: true,
        item: { enabled: true }
      },
      include: {
        item: true
      },
      orderBy: {
        buyPrice: "asc"
      }
    });

    return {
      farmId,
      offers: offers.map((offer) => ({
        id: offer.id,
        itemDefinitionId: offer.itemDefinitionId,
        name: offer.item.name,
        category: offer.item.category,
        buyPrice: offer.buyPrice.toString(),
        minLevel: offer.minLevel,
        locked: farm.level < offer.minLevel
      }))
    };
  }

  @Post("farms/:farmId/shop/buy")
  async buy(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const parsed = ShopBuyBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid shop purchase payload",
          details: { issues: parsed.error.issues }
        }
      });
    }

    try {
      const result = await buyFromShop(this.db.client, {
        actorUserId: session.user.id,
        farmId,
        offerId: parsed.data.offerId,
        quantity: parsed.data.quantity,
        idempotencyKey
      });
      return envelope(req, result);
    } catch (error) {
      mapDomainError(error);
    }
  }

  @Post("farms/:farmId/market/quick-sell")
  async sell(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const parsed = QuickSellBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid quick-sell payload",
          details: { issues: parsed.error.issues }
        }
      });
    }

    try {
      const result = await quickSell(this.db.client, {
        actorUserId: session.user.id,
        farmId,
        inventoryItemId: parsed.data.inventoryItemId,
        quantity: parsed.data.quantity,
        idempotencyKey
      });
      return envelope(req, result);
    } catch (error) {
      mapDomainError(error);
    }
  }

  @Post("farms/:farmId/inventory/:inventoryItemId/discard")
  async discard(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Param("inventoryItemId") inventoryItemId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const parsed = DiscardBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid discard payload",
          details: { issues: parsed.error.issues }
        }
      });
    }

    try {
      const result = await discardInventory(this.db.client, {
        actorUserId: session.user.id,
        farmId,
        inventoryItemId,
        quantity: parsed.data.quantity,
        idempotencyKey
      });
      return envelope(req, result);
    } catch (error) {
      mapDomainError(error);
    }
  }
}

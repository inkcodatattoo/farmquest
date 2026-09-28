import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UnprocessableEntityException
} from "@nestjs/common";
import type { Request } from "express";
import {
  DiscardBody,
  QuickSellBody,
  ShopBuyBody,
  Uuid
} from "@farmquest/contracts";
import {
  buyFromShop,
  discardInventoryItem,
  DomainError,
  quickSell
} from "@farmquest/domain";
import { AuthService } from "../auth/auth.service.js";
import { DatabaseService } from "../database.service.js";
import {
  mapDomainError,
  mutationEnvelope,
  requireIdempotencyKey
} from "../http/economic-http.js";

function readEnvelope(
  req: Request,
  data: unknown
): Record<string, unknown> {
  return {
    data,
    meta: {
      requestId: req.header("x-request-id") ?? randomUUID(),
      serverTime: new Date().toISOString()
    }
  };
}

async function requirePlayableFarm(
  req: Request,
  db: DatabaseService,
  auth: AuthService,
  farmId: string
) {
  const session = await auth.requireSession(req);

  const farm = await db.client.farm.findUnique({
    where: { id: farmId },
    include: {
      user: true,
      membership: true,
      streamer: true
    }
  });

  if (!farm || farm.userId !== session.user.id) {
    mapDomainError(req, new DomainError("FARM_NOT_FOUND"));
  }
  if (farm.status === "SOLD") {
    mapDomainError(req, new DomainError("FARM_SOLD"));
  }
  if (farm.user.status !== "ACTIVE") {
    mapDomainError(req, new DomainError("USER_BANNED"));
  }
  if (!farm.membership || farm.membership.status !== "ACTIVE") {
    mapDomainError(req, new DomainError("FARM_ACCESS_REMOVED"));
  }
  if (farm.streamer.approvalStatus === "SUSPENDED") {
    mapDomainError(req, new DomainError("FARM_STREAMER_SUSPENDED"));
  }

  return { session, farm };
}

@Controller("api/v1/farms")
export class FarmEconomyController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  @Get(":farmId/inventory")
  async inventory(
    @Req() req: Request,
    @Param("farmId") farmId: string
  ) {
    await requirePlayableFarm(req, this.db, this.auth, farmId);

    const rows = await this.db.client.inventoryItem.findMany({
      where: { farmId },
      include: {
        item: true,
        quality: true
      },
      orderBy: [
        { itemDefinitionId: "asc" },
        { qualityId: "asc" }
      ]
    });

    const data = rows.map((row) => {
      const quantity = Number(row.quantity);
      const reservedQuantity = Number(row.reservedQuantity);

      if (
        !Number.isSafeInteger(quantity) ||
        !Number.isSafeInteger(reservedQuantity)
      ) {
        throw new Error("INVENTORY_QUANTITY_EXCEEDS_HTTP_CONTRACT");
      }

      return {
        id: row.id,
        itemDefinitionId: row.itemDefinitionId,
        name: row.item.name,
        quality: row.quality.code,
        quantity,
        reservedQuantity
      };
    });

    return readEnvelope(req, data);
  }

  @Post(":farmId/inventory/:inventoryItemId/discard")
  async discard(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Param("inventoryItemId") inventoryItemId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(req, idempotencyHeader);
    const parsed = DiscardBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid discard payload",
          details: { issues: parsed.error.issues }
        },
        meta: {
          requestId: req.header("x-request-id") ?? randomUUID()
        }
      });
    }

    try {
      const result = await discardInventoryItem(this.db.client, {
        actorUserId: session.user.id,
        farmId,
        inventoryItemId,
        quantity: parsed.data.quantity,
        idempotencyKey
      });

      return mutationEnvelope(req, result);
    } catch (error) {
      mapDomainError(req, error);
    }
  }

  @Post(":farmId/shop/buy")
  async buy(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(req, idempotencyHeader);
    const parsed = ShopBuyBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid shop purchase payload",
          details: { issues: parsed.error.issues }
        },
        meta: {
          requestId: req.header("x-request-id") ?? randomUUID()
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

      return mutationEnvelope(req, result);
    } catch (error) {
      mapDomainError(req, error);
    }
  }

  @Post(":farmId/market/quick-sell")
  async quickSell(
    @Req() req: Request,
    @Param("farmId") farmId: string,
    @Headers("idempotency-key") idempotencyHeader: string | undefined,
    @Body() body: unknown
  ) {
    const session = await this.auth.requireCsrf(req);
    const idempotencyKey = requireIdempotencyKey(req, idempotencyHeader);
    const parsed = QuickSellBody.safeParse(body);

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid quick-sell payload",
          details: { issues: parsed.error.issues }
        },
        meta: {
          requestId: req.header("x-request-id") ?? randomUUID()
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

      return mutationEnvelope(req, result);
    } catch (error) {
      mapDomainError(req, error);
    }
  }
}

@Controller("api/v1/shop")
export class ShopCatalogController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("farmId") farmIdRaw: string | undefined
  ) {
    const parsedFarmId = Uuid.safeParse(farmIdRaw);

    if (!parsedFarmId.success) {
      throw new UnprocessableEntityException({
        error: {
          code: "VALIDATION_ERROR",
          message: "farmId must be a UUID"
        },
        meta: {
          requestId: req.header("x-request-id") ?? randomUUID()
        }
      });
    }

    const { farm } = await requirePlayableFarm(
      req,
      this.db,
      this.auth,
      parsedFarmId.data
    );

    const offers = await this.db.client.shopOffer.findMany({
      where: {
        enabled: true,
        minLevel: { lte: farm.level },
        item: { enabled: true }
      },
      include: { item: true },
      orderBy: { itemDefinitionId: "asc" }
    });

    return readEnvelope(
      req,
      offers.map((offer) => ({
        id: offer.id,
        itemDefinitionId: offer.itemDefinitionId,
        itemName: offer.item.name,
        buyPrice: offer.buyPrice.toString(),
        minLevel: offer.minLevel,
        enabled: offer.enabled
      }))
    );
  }
}

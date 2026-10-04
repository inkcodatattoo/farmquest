import { randomUUID } from "node:crypto";
import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnprocessableEntityException
} from "@nestjs/common";
import type { Request } from "express";
import { canFitInventory } from "@farmquest/game-rules";
import { AuthService } from "../auth/auth.service.js";
import { DatabaseService } from "../database.service.js";

/*
 * =========================================================
 * FARMQUEST — SISTEMA DA VACA
 * =========================================================
 *
 * - Alimentar custa 20 moedas
 * - Produz 1 Balde de Leite a cada 3 horas
 * - Armazena no máximo 1 leite
 * - Leite não apodrece
 * - Depois de coletar, é necessário alimentar novamente
 */

const COW_FEED_COST = 20n;

/* 3 horas */
const COW_PRODUCTION_MS = 3 * 60 * 60 * 1000;

function envelope(
  req: Request,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    data,
    meta: {
      requestId: req.header("x-request-id") ?? randomUUID(),
      serverTime: new Date().toISOString()
    }
  };
}

function fail(
  code: string,
  details?: Record<string, unknown>
): never {
  throw new UnprocessableEntityException({
    error: {
      code,
      message: code,
      ...(details ? { details } : {})
    }
  });
}

function ensurePlayableFarm<
  T extends
    | {
        id: string;
        userId: string;
        status: string;
        stackLimit: number;
        inventorySlots: number;

        user: {
          status: string;
        };

        membership: {
          status: string;
        } | null;

        streamer: {
          approvalStatus: string;
        };
      }
    | null
>(
  farm: T,
  userId: string
): Exclude<T, null> {
  if (!farm || farm.userId !== userId) {
    throw new NotFoundException({
      error: {
        code: "FARM_NOT_FOUND",
        message: "FARM_NOT_FOUND"
      }
    });
  }

  if (farm.status !== "ACTIVE") {
    fail("FARM_SOLD");
  }

  if (farm.user.status !== "ACTIVE") {
    fail("USER_BANNED");
  }

  if (!farm.membership || farm.membership.status !== "ACTIVE") {
    fail("FARM_ACCESS_REMOVED");
  }

  if (farm.streamer.approvalStatus === "SUSPENDED") {
    fail("FARM_STREAMER_SUSPENDED");
  }

  return farm as Exclude<T, null>;
}

@Controller("api/v1/farms")
export class AnimalController {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,

    @Inject(AuthService)
    private readonly auth: AuthService
  ) {}

  /*
   * =======================================================
   * GET STATUS DA VACA
   *
   * GET /api/v1/farms/:farmId/animals/cow
   * =======================================================
   */

  @Get(":farmId/animals/cow")
  async cowStatus(
    @Req() req: Request,
    @Param("farmId") farmId: string
  ) {
    const session = await this.auth.requireSession(req);

    const farmResult = await this.db.client.farm.findUnique({
      where: {
        id: farmId
      },
      include: {
        user: true,
        membership: true,
        streamer: true
      }
    });

    ensurePlayableFarm(
      farmResult,
      session.user.id
    );

    /*
     * Pegamos a última alimentação da vaca.
     */
    const lastFeed =
      await this.db.client.coinLedger.findFirst({
        where: {
          farmId,
          reason: "COW_FEED"
        },
        orderBy: {
          id: "desc"
        }
      });

    /*
     * Pegamos a última coleta de leite.
     */
    const lastCollect =
      await this.db.client.itemLedger.findFirst({
        where: {
          farmId,
          reason: "COW_MILK_COLLECT"
        },
        orderBy: {
          id: "desc"
        }
      });

    /*
     * Existe ciclo ativo se:
     *
     * - já houve alimentação
     * - e não houve coleta depois dela
     */
    const activeCycle =
      Boolean(lastFeed) &&
      (
        !lastCollect ||
        lastFeed!.createdAt.getTime() >
          lastCollect.createdAt.getTime()
      );

    /*
     * Vaca parada.
     * Pode ser alimentada.
     */
    if (!activeCycle || !lastFeed) {
      return envelope(req, {
        status: "IDLE",

        feedCost: Number(COW_FEED_COST),

        productionSeconds:
          COW_PRODUCTION_MS / 1000,

        readyAt: null,

        storedMilk: 0
      });
    }

    /*
     * Calcula quando o leite ficará pronto.
     */
    const readyAt = new Date(
      lastFeed.createdAt.getTime() +
        COW_PRODUCTION_MS
    );

    const ready =
      Date.now() >= readyAt.getTime();

    /*
     * Se já passaram 3 horas:
     *
     * READY
     *
     * Caso contrário:
     *
     * PRODUCING
     */
    return envelope(req, {
      status: ready
        ? "READY"
        : "PRODUCING",

      feedCost: Number(COW_FEED_COST),

      productionSeconds:
        COW_PRODUCTION_MS / 1000,

      readyAt:
        readyAt.toISOString(),

      storedMilk:
        ready ? 1 : 0
    });
  }

  /*
   * =======================================================
   * ALIMENTAR A VACA
   *
   * POST /api/v1/farms/:farmId/animals/cow/feed
   * =======================================================
   */

  @Post(":farmId/animals/cow/feed")
  async feedCow(
    @Req() req: Request,
    @Param("farmId") farmId: string
  ) {
    const session =
      await this.auth.requireCsrf(req);

    const result =
      await this.db.client.$transaction(
        async (tx) => {
          /*
           * Bloqueia a fazenda durante a operação.
           */
          await tx.$queryRaw`
            SELECT id
            FROM farmquest.farm
            WHERE id = ${farmId}::uuid
            FOR NO KEY UPDATE
          `;

          const farmResult =
            await tx.farm.findUnique({
              where: {
                id: farmId
              },
              include: {
                user: true,
                membership: true,
                streamer: true
              }
            });

          const farm =
            ensurePlayableFarm(
              farmResult,
              session.user.id
            );

          /*
           * Descobre a última alimentação.
           */
          const lastFeed =
            await tx.coinLedger.findFirst({
              where: {
                farmId,
                reason: "COW_FEED"
              },
              orderBy: {
                id: "desc"
              }
            });

          /*
           * Descobre a última coleta.
           */
          const lastCollect =
            await tx.itemLedger.findFirst({
              where: {
                farmId,
                reason:
                  "COW_MILK_COLLECT"
              },
              orderBy: {
                id: "desc"
              }
            });

          const activeCycle =
            Boolean(lastFeed) &&
            (
              !lastCollect ||
              lastFeed!.createdAt.getTime() >
                lastCollect.createdAt.getTime()
            );

          /*
           * Se já estiver alimentada,
           * não pode alimentar novamente.
           */
          if (
            activeCycle &&
            lastFeed
          ) {
            const readyAt =
              new Date(
                lastFeed.createdAt.getTime() +
                  COW_PRODUCTION_MS
              );

            /*
             * Já existe leite esperando coleta.
             */
            if (
              Date.now() >=
              readyAt.getTime()
            ) {
              fail(
                "COW_MILK_WAITING"
              );
            }

            /*
             * Ainda está produzindo.
             */
            fail(
              "COW_ALREADY_FED",
              {
                readyAt:
                  readyAt.toISOString()
              }
            );
          }

          /*
           * Cobra 20 moedas.
           */
          const debit =
            await tx.$queryRaw<
              Array<{
                coins: bigint;
              }>
            >`
              UPDATE farmquest.farm

              SET coins =
                coins - ${COW_FEED_COST}

              WHERE
                id = ${farm.id}::uuid
                AND coins >= ${COW_FEED_COST}

              RETURNING coins
            `;

          const balance =
            debit[0];

          /*
           * Jogador não tem 20 moedas.
           */
          if (!balance) {
            fail(
              "INSUFFICIENT_COINS"
            );
          }

          /*
           * Registra a alimentação.
           *
           * O horário deste registro
           * será usado para calcular
           * as 3 horas.
           */
          const feedLedger =
            await tx.coinLedger.create({
              data: {
                farmId: farm.id,

                userId:
                  session.user.id,

                delta:
                  -COW_FEED_COST,

                balanceAfter:
                  balance.coins,

                reason:
                  "COW_FEED",

                referenceType:
                  "ANIMAL",

                referenceId:
                  "COW"
              }
            });

          /*
           * Horário em que o leite
           * estará pronto.
           */
          const readyAt =
            new Date(
              feedLedger.createdAt.getTime() +
                COW_PRODUCTION_MS
            );

          return {
            code:
              "COW_FEED_OK",

            coinsSpent:
              COW_FEED_COST.toString(),

            coinsAfter:
              balance.coins.toString(),

            readyAt:
              readyAt.toISOString()
          };
        }
      );

    return envelope(
      req,
      result
    );
  }

  /*
   * =======================================================
   * COLETAR LEITE
   *
   * POST /api/v1/farms/:farmId/animals/cow/collect
   * =======================================================
   */

  @Post(":farmId/animals/cow/collect")
  async collectCowMilk(
    @Req() req: Request,
    @Param("farmId") farmId: string
  ) {
    const session =
      await this.auth.requireCsrf(req);

    const result =
      await this.db.client.$transaction(
        async (tx) => {
          /*
           * Bloqueia a fazenda.
           */
          await tx.$queryRaw`
            SELECT id
            FROM farmquest.farm
            WHERE id = ${farmId}::uuid
            FOR NO KEY UPDATE
          `;

          const farmResult =
            await tx.farm.findUnique({
              where: {
                id: farmId
              },
              include: {
                user: true,
                membership: true,
                streamer: true
              }
            });

          const farm =
            ensurePlayableFarm(
              farmResult,
              session.user.id
            );

          /*
           * Última alimentação.
           */
          const lastFeed =
            await tx.coinLedger.findFirst({
              where: {
                farmId,
                reason: "COW_FEED"
              },
              orderBy: {
                id: "desc"
              }
            });

          /*
           * Última coleta.
           */
          const lastCollect =
            await tx.itemLedger.findFirst({
              where: {
                farmId,
                reason:
                  "COW_MILK_COLLECT"
              },
              orderBy: {
                id: "desc"
              }
            });

          const activeCycle =
            Boolean(lastFeed) &&
            (
              !lastCollect ||
              lastFeed!.createdAt.getTime() >
                lastCollect.createdAt.getTime()
            );

          /*
           * Vaca não foi alimentada.
           */
          if (
            !activeCycle ||
            !lastFeed
          ) {
            fail(
              "COW_NOT_FED"
            );
          }

          /*
           * Calcula quando ficará pronto.
           */
          const readyAt =
            new Date(
              lastFeed.createdAt.getTime() +
                COW_PRODUCTION_MS
            );

          const remainingMs =
            readyAt.getTime() -
            Date.now();

          /*
           * Ainda não passaram 3 horas.
           */
          if (
            remainingMs > 0
          ) {
            fail(
              "COW_MILK_NOT_READY",
              {
                remainingSeconds:
                  Math.ceil(
                    remainingMs /
                      1000
                  ),

                readyAt:
                  readyAt.toISOString()
              }
            );
          }

          /*
           * Busca o item Balde de Leite.
           */
          const milk =
            await tx.itemDefinition.findUnique({
              where: {
                key: "milk_bucket"
              }
            });

          if (!milk) {
            throw new Error(
              "MILK_ITEM_DEFINITION_MISSING"
            );
          }

          /*
           * Produtos animais não usam
           * qualidade neste momento.
           */
          const noneQuality =
            await tx
              .itemQualityDefinition
              .findUnique({
                where: {
                  code: "NONE"
                }
              });

          if (!noneQuality) {
            throw new Error(
              "NONE_QUALITY_MISSING"
            );
          }

          /*
           * Confere espaço no celeiro.
           */
          const inventory =
            await tx.inventoryItem.findMany({
              where: {
                farmId
              }
            });

          const fits =
            canFitInventory({
              stacks:
                inventory.map(
                  (item) => ({
                    key:
                      `${item.itemDefinitionId}:${item.qualityId}`,

                    quantity:
                      item.quantity
                  })
                ),

              additions: [
                {
                  key:
                    `${milk.id}:${noneQuality.id}`,

                  quantity: 1n
                }
              ],

              stackLimit:
                farm.stackLimit,

              inventorySlots:
                farm.inventorySlots
            });

          if (!fits) {
            fail(
              "INVENTORY_FULL"
            );
          }

          /*
           * Chave do stack do leite.
           */
          const inventoryKey = {
            farmId_itemDefinitionId_qualityId:
              {
                farmId,

                itemDefinitionId:
                  milk.id,

                qualityId:
                  noneQuality.id
              }
          };

          const existing =
            await tx.inventoryItem.findUnique({
              where:
                inventoryKey
            });

          /*
           * Adiciona +1 leite.
           */
          const updated =
            existing
              ? await tx.inventoryItem.update({
                  where:
                    inventoryKey,

                  data: {
                    quantity: {
                      increment:
                        1n
                    }
                  }
                })
              : await tx.inventoryItem.create({
                  data: {
                    farmId,

                    itemDefinitionId:
                      milk.id,

                    qualityId:
                      noneQuality.id,

                    quantity:
                      1n,

                    reservedQuantity:
                      0n
                  }
                });

          /*
           * Registra a coleta.
           *
           * Isso também encerra
           * o ciclo atual da vaca.
           */
          await tx.itemLedger.create({
            data: {
              farmId,

              itemDefinitionId:
                milk.id,

              qualityId:
                noneQuality.id,

              quantityDelta:
                1n,

              reservedDelta:
                0n,

              quantityAfter:
                updated.quantity,

              reservedAfter:
                updated.reservedQuantity,

              reason:
                "COW_MILK_COLLECT",

              referenceType:
                "ANIMAL",

              referenceId:
                "COW"
            }
          });

          return {
            code:
              "COW_MILK_COLLECT_OK",

            itemsAdded:
              1,

            itemName:
              "Balde de Leite"
          };
        }
      );

    return envelope(
      req,
      result
    );
  }
}
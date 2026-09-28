import { randomUUID } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import type { Request } from "express";
import { IdempotencyKey } from "@farmquest/contracts";
import { DomainError } from "@farmquest/domain";

function requestId(req: Request): string {
  return req.header("x-request-id") ?? randomUUID();
}

export function mapDomainError(req: Request, error: unknown): never {
  if (!(error instanceof DomainError)) throw error;

  const payload = {
    error: {
      code: error.code,
      message: error.code,
      ...(error.details ? { details: error.details } : {})
    },
    meta: {
      requestId: requestId(req)
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

export function requireIdempotencyKey(
  req: Request,
  value: string | undefined
): string {
  const parsed = IdempotencyKey.safeParse(value);

  if (!parsed.success) {
    throw new UnprocessableEntityException({
      error: {
        code: "IDEMPOTENCY_KEY_INVALID",
        message: "Idempotency-Key must contain 16 to 128 characters"
      },
      meta: {
        requestId: requestId(req)
      }
    });
  }

  return parsed.data;
}

export function mutationEnvelope(
  req: Request,
  result: Record<string, unknown>
): Record<string, unknown> {
  const linearizedAt =
    typeof result.linearizedAt === "string"
      ? result.linearizedAt
      : undefined;

  const { linearizedAt: _removed, ...data } = result;

  return {
    data,
    meta: {
      requestId: requestId(req),
      serverTime: new Date().toISOString(),
      ...(linearizedAt ? { linearizedAt } : {})
    }
  };
}

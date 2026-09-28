import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  DiscardBody,
  FarmView,
  HarvestResponse,
  InventoryItemView,
  PlantBody,
  PlantResponse,
  PlotView,
  QuickSellBody,
  QuickSellResponse,
  ShopBuyBody
} from "../prototype-0.1.js";
import { ErrorEnvelope, Uuid } from "../common.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const IdempotencyHeader = z.object({
  "Idempotency-Key": z.string().min(16).max(128)
});

const FarmParams = z.object({ farmId: Uuid });
const PlotParams = z.object({ farmId: Uuid, plotId: Uuid });
const InventoryParams = z.object({ farmId: Uuid, inventoryItemId: Uuid });

const Json = (schema: z.ZodTypeAny) => ({
  "application/json": { schema }
});

const commonErrors = {
  403: {
    description: "Forbidden or invalid CSRF token",
    content: Json(ErrorEnvelope)
  },
  409: {
    description: "Conflict, duplicate state or idempotency conflict",
    content: Json(ErrorEnvelope)
  },
  422: {
    description: "Domain validation failed",
    content: Json(ErrorEnvelope)
  },
  429: {
    description: "Rate limited",
    content: Json(ErrorEnvelope)
  }
};

registry.register("FarmView", FarmView);
registry.register("PlotView", PlotView);
registry.register("InventoryItemView", InventoryItemView);
registry.register("PlantBody", PlantBody);
registry.register("PlantResponse", PlantResponse);
registry.register("HarvestResponse", HarvestResponse);
registry.register("DiscardBody", DiscardBody);
registry.register("ShopBuyBody", ShopBuyBody);
registry.register("QuickSellBody", QuickSellBody);
registry.register("QuickSellResponse", QuickSellResponse);
registry.register("ErrorEnvelope", ErrorEnvelope);

registry.registerPath({
  method: "get",
  path: "/api/v1/farms/{farmId}",
  request: { params: FarmParams },
  responses: {
    200: { description: "Farm state", content: Json(FarmView) },
    403: commonErrors[403],
    422: commonErrors[422]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/farms/{farmId}/plots",
  request: { params: FarmParams },
  responses: {
    200: { description: "Farm plots", content: Json(z.array(PlotView)) },
    403: commonErrors[403],
    422: commonErrors[422]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/plant",
  request: {
    params: FarmParams,
    headers: IdempotencyHeader,
    body: { content: Json(PlantBody) }
  },
  responses: {
    200: { description: "Planting completed", content: Json(PlantResponse) },
    ...commonErrors
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/plots/{plotId}/plant",
  request: {
    params: PlotParams,
    headers: IdempotencyHeader,
    body: { content: Json(PlantBody) }
  },
  responses: {
    200: { description: "Plot planted", content: Json(PlantResponse) },
    ...commonErrors
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/harvest",
  request: { params: FarmParams, headers: IdempotencyHeader },
  responses: {
    200: { description: "Harvest completed", content: Json(HarvestResponse) },
    ...commonErrors
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/plots/{plotId}/harvest",
  request: { params: PlotParams, headers: IdempotencyHeader },
  responses: {
    200: { description: "Plot harvested", content: Json(HarvestResponse) },
    ...commonErrors
  }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/farms/{farmId}/inventory",
  request: { params: FarmParams },
  responses: {
    200: {
      description: "Farm inventory",
      content: Json(z.array(InventoryItemView))
    },
    403: commonErrors[403],
    422: commonErrors[422]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/inventory/{inventoryItemId}/discard",
  request: {
    params: InventoryParams,
    headers: IdempotencyHeader,
    body: { content: Json(DiscardBody) }
  },
  responses: {
    200: { description: "Item discarded" },
    ...commonErrors
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/shop/buy",
  request: {
    params: FarmParams,
    headers: IdempotencyHeader,
    body: { content: Json(ShopBuyBody) }
  },
  responses: {
    200: { description: "Shop purchase completed" },
    ...commonErrors
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/market/quick-sell",
  request: {
    params: FarmParams,
    headers: IdempotencyHeader,
    body: { content: Json(QuickSellBody) }
  },
  responses: {
    200: { description: "Quick sale completed", content: Json(QuickSellResponse) },
    ...commonErrors
  }
});

const generator = new OpenApiGeneratorV31(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "FarmQuest Prototype 0.1 API",
    version: "0.1.0",
    description: "Contract generated from the canonical Zod schemas."
  }
});

const here = fileURLToPath(new URL(".", import.meta.url));
const output = resolve(here, "../../../../docs/openapi/farmquest-0.1.json");
mkdirSync(resolve(output, ".."), { recursive: true });
writeFileSync(output, JSON.stringify(document, null, 2) + "\n");
console.log(output);

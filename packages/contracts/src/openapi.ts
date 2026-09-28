import {
  OpenAPIRegistry,
  OpenApiGeneratorV31
} from "@asteasolutions/zod-to-openapi";
import { z } from "./zod.js";
import {
  BigIntString,
  ErrorEnvelope,
  IsoDateTime,
  RequestId,
  Uuid
} from "./common.js";
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
} from "./prototype-0.1.js";

const registry = new OpenAPIRegistry();

const ApiMeta = registry.register(
  "ApiMeta",
  z.object({
    requestId: RequestId,
    serverTime: IsoDateTime,
    linearizedAt: IsoDateTime.optional()
  })
);

const EmptyMutationBody = registry.register(
  "EmptyMutationBody",
  z.object({}).strict()
);

const FarmIdParams = z.object({ farmId: Uuid });
const PlotIdParams = z.object({ farmId: Uuid, plotId: Uuid });
const InventoryItemParams = z.object({
  farmId: Uuid,
  inventoryItemId: Uuid
});

const Success = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: schema,
    meta: ApiMeta
  });

const ErrorSchema = registry.register("ErrorEnvelope", ErrorEnvelope);
const FarmSchema = registry.register("FarmView", FarmView);
const PlotSchema = registry.register("PlotView", PlotView);
const PlantSchema = registry.register("PlantResponse", PlantResponse);
const HarvestSchema = registry.register("HarvestResponse", HarvestResponse);
const InventorySchema = registry.register("InventoryItemView", InventoryItemView);
const QuickSellSchema = registry.register("QuickSellResponse", QuickSellResponse);

const ShopOfferView = registry.register(
  "ShopOfferView",
  z.object({
    id: Uuid,
    itemDefinitionId: Uuid,
    itemName: z.string(),
    buyPrice: BigIntString,
    minLevel: z.int().positive(),
    enabled: z.boolean()
  })
);

const FarmListResponse = registry.register(
  "FarmListResponse",
  Success(z.array(FarmSchema))
);
const FarmResponse = registry.register("FarmResponse", Success(FarmSchema));
const PlotListResponse = registry.register(
  "PlotListResponse",
  Success(z.array(PlotSchema))
);
const PlantApiResponse = registry.register(
  "PlantApiResponse",
  Success(PlantSchema)
);
const HarvestApiResponse = registry.register(
  "HarvestApiResponse",
  Success(HarvestSchema)
);
const InventoryListResponse = registry.register(
  "InventoryListResponse",
  Success(z.array(InventorySchema))
);
const ShopListResponse = registry.register(
  "ShopListResponse",
  Success(z.array(ShopOfferView))
);
const QuickSellApiResponse = registry.register(
  "QuickSellApiResponse",
  Success(QuickSellSchema)
);

const ShopBuyResult = registry.register(
  "ShopBuyResult",
  z.object({
    code: z.literal("SHOP_BUY_OK"),
    coinsSpent: BigIntString,
    coinsAfter: BigIntString,
    itemsAdded: z.int().positive()
  })
);
const ShopBuyApiResponse = registry.register(
  "ShopBuyApiResponse",
  Success(ShopBuyResult)
);

const DiscardResult = registry.register(
  "DiscardResult",
  z.object({
    code: z.literal("DISCARD_OK"),
    quantityDiscarded: z.int().positive()
  })
);
const DiscardApiResponse = registry.register(
  "DiscardApiResponse",
  Success(DiscardResult)
);

const commonErrors = {
  403: {
    description: "Forbidden or CSRF validation failed",
    content: { "application/json": { schema: ErrorSchema } }
  },
  409: {
    description: "Idempotency or concurrent-state conflict",
    content: { "application/json": { schema: ErrorSchema } }
  },
  422: {
    description: "Domain rule rejected the request",
    content: { "application/json": { schema: ErrorSchema } }
  },
  429: {
    description: "Rate limited",
    content: { "application/json": { schema: ErrorSchema } }
  }
} as const;

const economicHeaders = [
  {
    name: "Idempotency-Key",
    in: "header" as const,
    required: true,
    schema: { type: "string", minLength: 16, maxLength: 128 }
  },
  {
    name: "X-CSRF-Token",
    in: "header" as const,
    required: true,
    schema: { type: "string" }
  }
];

registry.registerPath({
  method: "post",
  path: "/api/v1/dev/session",
  summary: "Create the protected Prototype 0.1 DEV session",
  request: {
    headers: z.object({
      "x-dev-login-secret": z.string().min(1)
    }),
    body: {
      content: {
        "application/json": { schema: EmptyMutationBody }
      }
    }
  },
  responses: {
    204: { description: "DEV session created" },
    404: { description: "DEV login is unavailable in this environment" },
    403: {
      description: "Invalid DEV login secret",
      content: { "application/json": { schema: ErrorSchema } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/farms",
  summary: "List farms available to the current DEV user",
  responses: {
    200: {
      description: "Farm list",
      content: { "application/json": { schema: FarmListResponse } }
    },
    403: commonErrors[403]
  }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/farms/{farmId}",
  summary: "Get one farm",
  request: { params: FarmIdParams },
  responses: {
    200: {
      description: "Farm",
      content: { "application/json": { schema: FarmResponse } }
    },
    403: commonErrors[403],
    404: {
      description: "Farm not found",
      content: { "application/json": { schema: ErrorSchema } }
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/farms/{farmId}/plots",
  summary: "Get calculated plot states using authoritative server time",
  request: { params: FarmIdParams },
  responses: {
    200: {
      description: "Plots",
      content: { "application/json": { schema: PlotListResponse } }
    },
    403: commonErrors[403],
    404: {
      description: "Farm not found",
      content: { "application/json": { schema: ErrorSchema } }
    }
  }
});

for (const route of [
  { path: "/api/v1/farms/{farmId}/plant", params: FarmIdParams },
  { path: "/api/v1/farms/{farmId}/plots/{plotId}/plant", params: PlotIdParams }
] as const) {
  registry.registerPath({
    method: "post",
    path: route.path,
    summary: "Plant crop",
    request: {
      params: route.params,
      headers: z.object({
        "idempotency-key": z.string().min(16).max(128),
        "x-csrf-token": z.string().min(1)
      }),
      body: {
        content: { "application/json": { schema: PlantBody } }
      }
    },
    responses: {
      200: {
        description: "Crop planted",
        content: { "application/json": { schema: PlantApiResponse } }
      },
      ...commonErrors
    }
  });
}

for (const route of [
  { path: "/api/v1/farms/{farmId}/harvest", params: FarmIdParams },
  { path: "/api/v1/farms/{farmId}/plots/{plotId}/harvest", params: PlotIdParams }
] as const) {
  registry.registerPath({
    method: "post",
    path: route.path,
    summary: "Harvest ready or rotten crops",
    request: {
      params: route.params,
      headers: z.object({
        "idempotency-key": z.string().min(16).max(128),
        "x-csrf-token": z.string().min(1)
      }),
      body: {
        content: { "application/json": { schema: EmptyMutationBody } }
      }
    },
    responses: {
      200: {
        description: "Harvest result",
        content: { "application/json": { schema: HarvestApiResponse } }
      },
      ...commonErrors
    }
  });
}

registry.registerPath({
  method: "get",
  path: "/api/v1/farms/{farmId}/inventory",
  summary: "Get farm inventory",
  request: { params: FarmIdParams },
  responses: {
    200: {
      description: "Inventory",
      content: { "application/json": { schema: InventoryListResponse } }
    },
    403: commonErrors[403]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/inventory/{inventoryItemId}/discard",
  summary: "Discard inventory item",
  request: {
    params: InventoryItemParams,
    headers: z.object({
      "idempotency-key": z.string().min(16).max(128),
      "x-csrf-token": z.string().min(1)
    }),
    body: {
      content: { "application/json": { schema: DiscardBody } }
    }
  },
  responses: {
    200: {
      description: "Item discarded",
      content: { "application/json": { schema: DiscardApiResponse } }
    },
    ...commonErrors
  }
});

registry.registerPath({
  method: "get",
  path: "/api/v1/shop",
  summary: "List provisional NPC shop offers (PD-06)",
  request: {
    query: z.object({ farmId: Uuid })
  },
  responses: {
    200: {
      description: "Shop offers",
      content: { "application/json": { schema: ShopListResponse } }
    },
    403: commonErrors[403]
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/shop/buy",
  summary: "Buy from provisional NPC shop (PD-06)",
  request: {
    params: FarmIdParams,
    headers: z.object({
      "idempotency-key": z.string().min(16).max(128),
      "x-csrf-token": z.string().min(1)
    }),
    body: {
      content: { "application/json": { schema: ShopBuyBody } }
    }
  },
  responses: {
    200: {
      description: "Purchase completed",
      content: { "application/json": { schema: ShopBuyApiResponse } }
    },
    ...commonErrors
  }
});

registry.registerPath({
  method: "post",
  path: "/api/v1/farms/{farmId}/market/quick-sell",
  summary: "Quick sell inventory with 2% fee",
  request: {
    params: FarmIdParams,
    headers: z.object({
      "idempotency-key": z.string().min(16).max(128),
      "x-csrf-token": z.string().min(1)
    }),
    body: {
      content: { "application/json": { schema: QuickSellBody } }
    }
  },
  responses: {
    200: {
      description: "Quick sale completed",
      content: { "application/json": { schema: QuickSellApiResponse } }
    },
    ...commonErrors
  }
});

export function generatePrototype01OpenApi() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "FarmQuest API — Prototype 0.1",
      version: "0.1.0",
      description:
        "Generated from the canonical Zod contracts. BigInt economic values are decimal strings in JSON."
    },
    servers: [{ url: "/" }]
  });
}

export const prototype01EconomicHeaders = economicHeaders;

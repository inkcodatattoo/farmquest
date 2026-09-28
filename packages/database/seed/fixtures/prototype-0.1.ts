export const PROTOTYPE_01_FIXTURES = {
  meta: {
    prototype: "0.1",
    provisional: true,
    warning: "Valores provisórios não viram regra fechada."
  },

  identity: {
    devUserDisplayName: "Coda",
    streamerApprovalStatus: "APPROVED",
    membershipStatus: "ACTIVE"
  },

  farm: {
    initialCoins: { value: 100n, closed: true },
    initialPlots: { value: 3, closed: true },
    initialSeeds: { value: 3, closed: true },
    starterSeedKey: { value: "corn_seed", provisional: true, pending: "PD-23" },
    inventorySlots: { value: 20, provisional: true, pending: "PD-23" },
    stackLimit: { value: 200, provisional: true, pending: "PD-23" }
  },

  crop: {
    key: "corn",
    seedItemKey: "corn_seed",
    productItemKey: "corn",
    growthSeconds: { value: 60, provisional: true, pending: "PD-23" },
    yieldPerSeed: { value: 1, provisional: true, pending: "PD-23" },
    harvestXpPerSeed: { value: 5n, provisional: true, pending: "PD-23" },
    rotAfterSeconds: { value: 86_400, closed: true }
  },

  npcShop: {
    source: { value: "NPC_SHOP", provisional: true, pending: "PD-06" },
    cornSeedBuyPrice: { value: 5n, provisional: true, pending: "PD-23" },
    minLevel: 1,
    enabled: true
  },

  quickSell: {
    cornBasePrice: { value: 10n, provisional: true, pending: "PD-23" },
    feeBps: { value: 200n, closed: true }
  },

  qualities: [
    { code: "COMMON", weight: 7000, sellBps: 10000, xpBps: 10000, drawable: true },
    { code: "GOOD", weight: 2500, sellBps: 12500, xpBps: 11000, drawable: true },
    { code: "EXCELLENT", weight: 490, sellBps: 15000, xpBps: 12500, drawable: true },
    { code: "EXTRAORDINARY", weight: 10, sellBps: 30000, xpBps: 20000, drawable: true },
    { code: "ROTTEN", weight: 0, sellBps: 0, xpBps: 0, drawable: false },
    { code: "NONE", weight: 0, sellBps: 0, xpBps: 0, drawable: false }
  ].map((quality) => ({
    ...quality,
    provisional: true,
    pending: "PD-23"
  })),

  actionXp: {
    PLANT: { value: 5n, per: "ACTION", provisional: true, pending: "PD-23" },
    NPC_SELL: { value: 2n, per: "ACTION", provisional: true, pending: "PD-19/PD-23" },
    HARVEST_BONUS: { value: 0n, enabled: false }
  },

  levels: [
    { level: 1, xpRequiredTotal: 0n, harvestCooldownSeconds: 60 },
    { level: 2, xpRequiredTotal: 100n, harvestCooldownSeconds: 55 },
    { level: 3, xpRequiredTotal: 300n, harvestCooldownSeconds: 50 },
    { level: 4, xpRequiredTotal: 650n, harvestCooldownSeconds: 45 },
    { level: 5, xpRequiredTotal: 1200n, harvestCooldownSeconds: 40 }
  ].map((level) => ({
    ...level,
    provisional: true,
    pending: "PD-23"
  })),

  behavior: {
    PD06: "NPC_SHOP",
    PD07: "PLOT_AND_ALL_SAME_COOLDOWN",
    PD08: "HARVEST_IN_SLOT_ORDER_WHILE_FITS",
    PD09: "ONE_QUALITY_ROLL_PER_PLANTING",
    PD19: "XP_ONLY_NPC_QUICK_SELL",
    PD23: "THIS_MANIFEST"
  },

  services: {
    web: true,
    api: true,
    postgres: true,
    worker: false,
    twitchBot: false
  }
} as const;

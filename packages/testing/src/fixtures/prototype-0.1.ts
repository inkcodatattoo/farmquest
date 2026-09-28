export const prototype01Fixtures = {
  provisional: true,
  farm: {
    initialCoins: 100n,
    initialPlots: 3,
    initialSeeds: 3,
    inventorySlots: { value: 20, pending: "PD-23" },
    stackLimit: { value: 200, pending: "PD-23" }
  },
  crop: {
    key: "corn",
    starterSeed: { value: "corn_seed", pending: "PD-23" },
    growthSeconds: { value: 60, pending: "PD-23" },
    yieldPerSeed: { value: 1, pending: "PD-23" },
    harvestXpPerSeed: { value: 5n, pending: "PD-23" },
    rotAfterSeconds: 86_400
  },
  shop: {
    source: { value: "NPC", pending: "PD-06" },
    cornSeedBuyPrice: { value: 5n, pending: "PD-23" }
  },
  quickSell: {
    cornBasePrice: { value: 10n, pending: "PD-23" },
    feeBps: 200
  },
  harvest: {
    siteRoutes: { value: "PLOT_AND_ALL", pending: "PD-07" },
    inventoryFull: { value: "HARVEST_WHILE_FITS", pending: "PD-08" },
    qualityRoll: { value: "PER_PLANTING", pending: "PD-09" }
  },
  saleXp: {
    source: { value: "QUICK_SELL_ONLY", pending: "PD-19" }
  },
  qualities: {
    COMMON: { weight: 7000, sellBps: 10000, xpBps: 10000 },
    GOOD: { weight: 2500, sellBps: 12500, xpBps: 11000 },
    EXCELLENT: { weight: 490, sellBps: 15000, xpBps: 12500 },
    EXTRAORDINARY: { weight: 10, sellBps: 30000, xpBps: 20000 }
  }
} as const;

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FarmWorld,
  type FarmWorldFarm,
  type FarmWorldInventoryItem,
  type FarmWorldPlot,
  type FarmWorldShopOffer
} from "../farm-world";

function createPlots(now: number): FarmWorldPlot[] {
  return [
    {
      id: "preview-plot-1",
      slotNumber: 1,
      seedsCapacity: 1,
      state: "EMPTY",
      planted: null
    },
    {
      id: "preview-plot-2",
      slotNumber: 2,
      seedsCapacity: 1,
      state: "PLANTED",
      planted: {
        cropName: "Milho",
        seedCount: 1,
        growsAt: new Date(now + 25_000).toISOString(),
        rotsAt: new Date(now + 120_000).toISOString()
      }
    },
    {
      id: "preview-plot-3",
      slotNumber: 3,
      seedsCapacity: 1,
      state: "READY",
      planted: {
        cropName: "Milho",
        seedCount: 1,
        growsAt: new Date(now - 5_000).toISOString(),
        rotsAt: new Date(now + 90_000).toISOString()
      }
    }
  ];
}

const INITIAL_FARM: FarmWorldFarm = {
  id: "preview-farm",
  level: 1,
  xp: "20",
  coins: "100",
  inventorySlots: 20
};

const INITIAL_INVENTORY: FarmWorldInventoryItem[] = [
  {
    id: "preview-seeds",
    name: "Semente de Milho",
    quality: "NONE",
    quantity: 3
  },
  {
    id: "preview-corn",
    name: "Milho",
    quality: "GOOD",
    quantity: 2
  },
  {
    id: "preview-wheat",
    name: "Trigo",
    quality: "COMMON",
    quantity: 4
  },
  {
    id: "preview-strawberry",
    name: "Morango",
    quality: "EXCELLENT",
    quantity: 2
  },
  {
    id: "preview-tomato",
    name: "Tomate",
    quality: "EXTRAORDINARY",
    quantity: 1
  },
  {
    id: "preview-potato",
    name: "Batata",
    quality: "GOOD",
    quantity: 3
  },
  {
    id: "preview-rotten-corn",
    name: "Milho",
    quality: "ROTTEN",
    quantity: 1
  }
];

const PREVIEW_SHOP: FarmWorldShopOffer[] = [
  {
    id: "preview-shop-corn",
    itemName: "Semente de Milho",
    buyPrice: "5",
    minLevel: 1
  },
  {
    id: "preview-shop-wheat",
    itemName: "Semente de Trigo",
    buyPrice: "6",
    minLevel: 1
  },
  {
    id: "preview-shop-carrot",
    itemName: "Semente de Cenoura",
    buyPrice: "7",
    minLevel: 1
  },
  {
    id: "preview-shop-strawberry",
    itemName: "Semente de Morango",
    buyPrice: "9",
    minLevel: 1
  },
  {
    id: "preview-shop-tomato",
    itemName: "Semente de Tomate",
    buyPrice: "8",
    minLevel: 1
  },
  {
    id: "preview-shop-potato",
    itemName: "Semente de Batata",
    buyPrice: "7",
    minLevel: 1
  }
];

export default function FarmPreviewClient() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [farm, setFarm] = useState(INITIAL_FARM);
  const [plots, setPlots] = useState<FarmWorldPlot[]>(() => createPlots(Date.now()));
  const [inventory, setInventory] = useState<FarmWorldInventoryItem[]>(INITIAL_INVENTORY);
  const [notice, setNotice] = useState("Modo de prévia visual — nada aqui altera sua fazenda real.");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seedCount = useMemo(
    () => inventory.find((item) => item.id === "preview-seeds")?.quantity ?? 0,
    [inventory]
  );

  function addXp(amount: number) {
    setFarm((current) => ({
      ...current,
      xp: String(Number(current.xp) + amount)
    }));
  }

  function spendSeed() {
    setInventory((items) =>
      items.map((item) =>
        item.id === "preview-seeds"
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item
      )
    );
  }

  function plantPlot(plotId: string) {
    if (seedCount <= 0) {
      setError("Sem sementes na prévia. Compre uma no Mercado.");
      return;
    }

    const now = Date.now();
    setPlots((current) =>
      current.map((plot) =>
        plot.id === plotId && !plot.planted
          ? {
              ...plot,
              state: "PLANTED",
              planted: {
                cropName: "Milho",
                seedCount: 1,
                growsAt: new Date(now + 25_000).toISOString(),
                rotsAt: new Date(now + 120_000).toISOString()
              }
            }
          : plot
      )
    );
    spendSeed();
    addXp(5);
    setError("");
    setNotice("Milho plantado na prévia. Ele ficará pronto em cerca de 25 segundos.");
  }

  function harvestPlot(plotId: string) {
    const target = plots.find((plot) => plot.id === plotId);
    if (!target?.planted || Date.now() < Date.parse(target.planted.growsAt)) return;

    setPlots((current) =>
      current.map((plot) =>
        plot.id === plotId
          ? { ...plot, state: "EMPTY", planted: null }
          : plot
      )
    );

    setInventory((items) => {
      const corn = items.find((item) => item.id === "preview-corn");
      if (corn) {
        return items.map((item) =>
          item.id === "preview-corn"
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...items,
        {
          id: "preview-corn",
          name: "Milho",
          quality: "GOOD",
          quantity: 1
        }
      ];
    });

    addXp(5);
    setError("");
    setNotice("Colheita concluída na prévia: +1 milho e +5 XP.");
  }

  function plantAll() {
    const emptyPlots = plots.filter((plot) => !plot.planted);
    if (emptyPlots.length === 0) {
      setError("Não há canteiros vazios.");
      return;
    }
    if (seedCount === 0) {
      setError("Sem sementes na prévia.");
      return;
    }

    let remainingSeeds = seedCount;
    const now = Date.now();
    let planted = 0;
    setPlots((current) =>
      current.map((plot) => {
        if (plot.planted || remainingSeeds <= 0) return plot;
        remainingSeeds -= 1;
        planted += 1;
        return {
          ...plot,
          state: "PLANTED",
          planted: {
            cropName: "Milho",
            seedCount: 1,
            growsAt: new Date(now + 25_000).toISOString(),
            rotsAt: new Date(now + 120_000).toISOString()
          }
        };
      })
    );

    setInventory((items) =>
      items.map((item) =>
        item.id === "preview-seeds"
          ? { ...item, quantity: Math.max(0, item.quantity - planted) }
          : item
      )
    );
    addXp(planted * 5);
    setError("");
    setNotice(`${planted} canteiro${planted === 1 ? "" : "s"} plantado${planted === 1 ? "" : "s"} na prévia.`);
  }

  function harvestAll() {
    const ready = plots.filter(
      (plot) => plot.planted && Date.now() >= Date.parse(plot.planted.growsAt)
    );
    if (ready.length === 0) {
      setError("Nenhuma colheita está pronta ainda.");
      return;
    }
    ready.forEach((plot) => harvestPlot(plot.id));
  }

  function sell(itemId: string) {
    const item = inventory.find((entry) => entry.id === itemId);
    if (!item || item.quantity <= 0 || item.quality === "NONE") return;

    setInventory((items) =>
      items
        .map((entry) =>
          entry.id === itemId ? { ...entry, quantity: entry.quantity - 1 } : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
    setFarm((current) => ({
      ...current,
      coins: String(Number(current.coins) + 8)
    }));
    setNotice("Venda simulada: +8 moedas.");
    setError("");
  }

  function discard(itemId: string) {
    setInventory((items) =>
      items
        .map((entry) =>
          entry.id === itemId ? { ...entry, quantity: entry.quantity - 1 } : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
    setNotice("Item descartado na prévia.");
    setError("");
  }

  function buy(offerId: string) {
    const offer = PREVIEW_SHOP.find((entry) => entry.id === offerId);
    if (!offer) return;

    const price = Number(offer.buyPrice);
    if (Number(farm.coins) < price) {
      setError("Moedas insuficientes.");
      return;
    }

    setFarm((current) => ({
      ...current,
      coins: String(Number(current.coins) - price)
    }));

    const inventoryId =
      offer.id === "preview-shop-corn"
        ? "preview-seeds"
        : `preview-${offer.id.replace("preview-shop-", "")}-seeds`;

    setInventory((items) => {
      const seeds = items.find((entry) => entry.id === inventoryId);
      if (seeds) {
        return items.map((entry) =>
          entry.id === inventoryId
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        );
      }
      return [
        ...items,
        {
          id: inventoryId,
          name: offer.itemName,
          quality: "NONE",
          quantity: 1
        }
      ];
    });

    setNotice(`Compra simulada: +1 ${offer.itemName.toLowerCase()} por ${price} moedas.`);
    setError("");
  }

  return (
    <FarmWorld
      userName="Coda"
      farm={farm}
      plots={plots}
      inventory={inventory}
      shop={PREVIEW_SHOP}
      cooldownText="Livre"
      nowMs={nowMs}
      busy=""
      notice={notice}
      error={error}
      onRefresh={() => {
        const now = Date.now();
        setFarm(INITIAL_FARM);
        setPlots(createPlots(now));
        setInventory(INITIAL_INVENTORY);
        setNowMs(now);
        setNotice("Prévia reiniciada.");
        setError("");
      }}
      onLogout={() => {
        setNotice("O botão Sair está desativado apenas no modo de prévia.");
        setError("");
      }}
      onPlantAll={plantAll}
      onHarvestAll={harvestAll}
      onPlantPlot={plantPlot}
      onHarvestPlot={harvestPlot}
      onSell={sell}
      onDiscard={discard}
      onBuy={buy}
    />
  );
}

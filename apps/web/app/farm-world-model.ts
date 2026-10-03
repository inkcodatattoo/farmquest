import {
  FARM_ICONS,
  iconForCropName
} from "./farm-icons";

export type FarmWorldFarm = {
  id: string;
  level: number;

  xp: string;

  xpLevelStart: string;
  xpNextLevel: string | null;

  coins: string;

  inventorySlots: number;
};

export type FarmWorldPlotState = "EMPTY" | "PLANTED" | "READY" | "ROTTEN";

export type FarmWorldPlot = {
  id: string;
  slotNumber: number;
  unlocked: boolean;
  seedsCapacity: number;
  state: FarmWorldPlotState;
  planted: null | {
  cropDefinitionId: string;
  cropName: string;
  seedCount: number;
  plantedAt: string;
  growsAt: string;
  rotsAt: string;

  quality?:
    | "COMMON"
    | "GOOD"
    | "EXCELLENT"
    | "EXTRAORDINARY"
    | "ROTTEN"
    | null;
};
};

export type FarmWorldInventoryItem = {
  id: string;
  name: string;
  quality: "NONE" | "COMMON" | "GOOD" | "EXCELLENT" | "EXTRAORDINARY" | "ROTTEN";
  quantity: number;
};

export type FarmWorldShopOffer = {
  id: string;
  itemName: string;
  buyPrice: string;
  minLevel: number;
};

export type Section =
  | "inicio"
  | "plantacoes"
  | "animais"
  | "celeiro"
  | "mercado"
  | "pedidos"
  | "comunidade"
  | "exploracao"
  | "ranking"
  | "conquistas";

export type FarmWorldProps = {
  userName: string;
  farm: FarmWorldFarm;
  plots: FarmWorldPlot[];
  inventory: FarmWorldInventoryItem[];
  shop: FarmWorldShopOffer[];
  cooldownText: string;
  canHarvest: boolean;
  nowMs: number;
  busy: string;
  notice: string;
  error: string;
  onRefresh: () => void;
  onLogout: () => void;
  onPlantAll: () => void;
  onHarvestAll: () => void;
  onPlantPlot: (plotId: string) => void;
  onHarvestPlot: (plotId: string) => void;
  onSell: (itemId: string) => void;
  onDiscard: (itemId: string) => void;
  onBuy: (offerId: string) => void;
};

export type FarmPlotVisualState =
  | "LOCKED"
  | "AVAILABLE"
  | "PLANTED"
  | "READY"
  | "ROTTEN";

export type FarmPlotSlot = {
  slotNumber: number;
  plot: FarmWorldPlot | null;
  state: FarmPlotVisualState;
};

export type FarmWorldNavigationItem = {
  key: Section;
  label: string;
  icon: string;
  home: boolean;
  dock: boolean;
  dockLabel?: string;
  dockHint?: string;
};

export const MAX_FARM_PLOTS = 10;

export const FARM_WORLD_NAVIGATION: readonly FarmWorldNavigationItem[] = [
  {
    key: "inicio",
    label: "Início",
    icon: FARM_ICONS.buildings.farmhouse,
    home: true,
    dock: true,
    dockLabel: "Fazenda",
    dockHint: "Início"
  },
  {
    key: "plantacoes",
    label: "Plantações",
    icon: FARM_ICONS.actions.plant,
    home: true,
    dock: false
  },
  {
    key: "animais",
    label: "Animais",
    icon: FARM_ICONS.animals.chicken,
    home: true,
    dock: true,
    dockHint: "Fazenda"
  },
  {
    key: "celeiro",
    label: "Celeiro",
    icon: FARM_ICONS.buildings.barn,
    home: true,
    dock: true,
    dockLabel: "Inventário"
  },
  {
    key: "mercado",
    label: "Mercado",
    icon: FARM_ICONS.buildings.market,
    home: true,
    dock: true,
    dockHint: "Comprar"
  },
  {
    key: "pedidos",
    label: "Pedidos",
    icon: FARM_ICONS.community.harvestBox,
    home: false,
    dock: false
  },
  {
    key: "comunidade",
    label: "Comunidade",
    icon: FARM_ICONS.community.goal,
    home: true,
    dock: true,
    dockHint: "Cooperativo"
  },
  {
    key: "exploracao",
    label: "Exploração",
    icon: FARM_ICONS.rare.leafFossil,
    home: false,
    dock: false
  },
  {
    key: "ranking",
    label: "Ranking",
    icon: FARM_ICONS.ui.ranking,
    home: true,
    dock: true,
    dockHint: "Classificação"
  },
  {
    key: "conquistas",
    label: "Conquistas",
    icon: FARM_ICONS.ui.collector,
    home: false,
    dock: false
  }
];

export function resolvePlotState(
  plot: FarmWorldPlot | null | undefined,
  nowMs: number
): FarmPlotVisualState {
  if (!plot || !plot.unlocked) return "LOCKED";
  if (!plot.planted) return "AVAILABLE";
  if (nowMs >= Date.parse(plot.planted.rotsAt)) return "ROTTEN";
  if (nowMs >= Date.parse(plot.planted.growsAt)) return "READY";
  return "PLANTED";
}

export function buildFarmPlotSlots(
  plots: FarmWorldPlot[],
  nowMs: number,
  maxSlots = MAX_FARM_PLOTS
): FarmPlotSlot[] {
  const slotCount = Math.min(
    MAX_FARM_PLOTS,
    Math.max(0, Number.isFinite(maxSlots) ? Math.trunc(maxSlots) : MAX_FARM_PLOTS)
  );
  const plotsBySlot = new Map(
    plots
      .filter((plot) => plot.slotNumber >= 1 && plot.slotNumber <= slotCount)
      .map((plot) => [plot.slotNumber, plot] as const)
  );

  return Array.from({ length: slotCount }, (_, index) => {
    const slotNumber = index + 1;
    const plot = plotsBySlot.get(slotNumber) ?? null;

    return {
      slotNumber,
      plot,
      state: resolvePlotState(plot, nowMs)
    };
  });
}

export function timerText(
  plot: FarmWorldPlot | null | undefined,
  nowMs: number
): string {
  if (!plot?.planted) return "";

  const milliseconds = Date.parse(plot.planted.growsAt) - nowMs;
  if (milliseconds <= 0) return "Pronto";

  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function plotStateLabel(state: FarmPlotVisualState): string {
  switch (state) {
    case "LOCKED":
      return "Bloqueado";
    case "AVAILABLE":
      return "Disponível";
    case "PLANTED":
      return "Crescendo";
    case "READY":
      return "Pronto";
    case "ROTTEN":
      return "Apodrecido";
  }
}

export function qualityLabel(quality: FarmWorldInventoryItem["quality"]): string {
  switch (quality) {
    case "NONE":
      return "Sem qualidade";
    case "COMMON":
      return "Comum";
    case "GOOD":
      return "Boa";
    case "EXCELLENT":
      return "Excelente";
    case "EXTRAORDINARY":
      return "Extraordinário";
    case "ROTTEN":
      return "Apodrecido";
  }
}

export function iconForPlot(
  plot: FarmWorldPlot | null | undefined,
  nowMs: number
): string {
  const state = resolvePlotState(plot, nowMs);
  if (state === "LOCKED") return FARM_ICONS.plots.locked;
  if (state === "AVAILABLE") return FARM_ICONS.plots.empty;
  if (state === "ROTTEN") return FARM_ICONS.quality.rottenItem;
  return iconForCropName(plot?.planted?.cropName);
}

export function canInteract(
  state: FarmPlotVisualState,
  canHarvest: boolean
): boolean {
  if (state === "AVAILABLE") return true;
  if (state === "READY" || state === "ROTTEN") return canHarvest;
  return false;
}

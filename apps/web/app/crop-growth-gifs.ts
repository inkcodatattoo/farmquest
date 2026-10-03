export type CropGrowthStage = 1 | 2 | 3 | 4;

export const CROP_GROWTH_GIFS = {
  milho: {
    1: "/game-assets/crops/growth/milho_stage_1.gif",
    2: "/game-assets/crops/growth/milho_stage_2.gif",
    3: "/game-assets/crops/growth/milho_stage_3.gif",
    4: "/game-assets/crops/growth/milho_stage_4.gif",
  },

  trigo: {
    1: "/game-assets/crops/growth/trigo_stage_1.gif",
    2: "/game-assets/crops/growth/trigo_stage_2.gif",
    3: "/game-assets/crops/growth/trigo_stage_3.gif",
    4: "/game-assets/crops/growth/trigo_stage_4.gif",
  },

  cenoura: {
    1: "/game-assets/crops/growth/cenoura_stage_1.gif",
    2: "/game-assets/crops/growth/cenoura_stage_2.gif",
    3: "/game-assets/crops/growth/cenoura_stage_3.gif",
    4: "/game-assets/crops/growth/cenoura_stage_4.gif",
  },

  morango: {
    1: "/game-assets/crops/growth/morango_stage_1.gif",
    2: "/game-assets/crops/growth/morango_stage_2.gif",
    3: "/game-assets/crops/growth/morango_stage_3.gif",
    4: "/game-assets/crops/growth/morango_stage_4.gif",
  },

  tomate: {
    1: "/game-assets/crops/growth/tomate_stage_1.gif",
    2: "/game-assets/crops/growth/tomate_stage_2.gif",
    3: "/game-assets/crops/growth/tomate_stage_3.gif",
    4: "/game-assets/crops/growth/tomate_stage_4.gif",
  },

  batata: {
    1: "/game-assets/crops/growth/batata_stage_1.gif",
    2: "/game-assets/crops/growth/batata_stage_2.gif",
    3: "/game-assets/crops/growth/batata_stage_3.gif",
    4: "/game-assets/crops/growth/batata_stage_4.gif",
  },
} as const;

export type CropGrowthKey = keyof typeof CROP_GROWTH_GIFS;

/**
 * Converte o nome recebido da API para uma das culturas
 * que possuem animações de crescimento no Home.
 */
export function getCropGrowthKey(
  cropName?: string | null
): CropGrowthKey | null {
  if (!cropName) return null;

  const normalized = cropName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (normalized.includes("milho") || normalized.includes("corn")) {
    return "milho";
  }

  if (normalized.includes("trigo") || normalized.includes("wheat")) {
    return "trigo";
  }

  if (normalized.includes("cenoura") || normalized.includes("carrot")) {
    return "cenoura";
  }

  if (normalized.includes("morango") || normalized.includes("strawberry")) {
    return "morango";
  }

  if (normalized.includes("tomate") || normalized.includes("tomato")) {
    return "tomate";
  }

  if (normalized.includes("batata") || normalized.includes("potato")) {
    return "batata";
  }

  return null;
}

/**
 * Divide o tempo total de crescimento em quatro fases.
 *
 * 0%  - 25%  = estágio 1
 * 25% - 50%  = estágio 2
 * 50% - 75%  = estágio 3
 * 75% - 100% = estágio 4
 */
export function getCropGrowthStage(
  plantedAt: string,
  growsAt: string,
  nowMs: number
): CropGrowthStage {
  const plantedMs = Date.parse(plantedAt);
  const growsMs = Date.parse(growsAt);

  if (
    !Number.isFinite(plantedMs) ||
    !Number.isFinite(growsMs) ||
    growsMs <= plantedMs
  ) {
    return 1;
  }

  if (nowMs >= growsMs) {
    return 4;
  }

  const totalGrowthTime = growsMs - plantedMs;
  const elapsedTime = Math.max(0, nowMs - plantedMs);

  const progress = elapsedTime / totalGrowthTime;

  if (progress < 0.25) return 1;
  if (progress < 0.5) return 2;
  if (progress < 0.75) return 3;

  return 4;
}

/**
 * Retorna o GIF correto da cultura e do estágio atual.
 *
 * Se a cultura ainda não tiver GIF próprio, retorna null
 * e o FarmQuest poderá continuar usando o ícone antigo.
 */
export function getCropGrowthGif(
  cropName: string | null | undefined,
  plantedAt: string | null | undefined,
  growsAt: string | null | undefined,
  nowMs: number
): string | null {
  if (!plantedAt || !growsAt) {
    return null;
  }

  const cropKey = getCropGrowthKey(cropName);

  if (!cropKey) {
    return null;
  }

  const stage = getCropGrowthStage(
    plantedAt,
    growsAt,
    nowMs
  );

  return CROP_GROWTH_GIFS[cropKey][stage];
}
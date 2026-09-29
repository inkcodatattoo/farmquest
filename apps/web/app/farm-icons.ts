export const FARM_ICONS = {
  buildings: {
    farmhouse: "/game-assets/icons/buildings/casa_fazenda.png",
    barn: "/game-assets/icons/buildings/celeiro.png",
    market: "/game-assets/icons/buildings/mercado_rural.png"
  },
  plots: {
    empty: "/game-assets/icons/plots/canteiro_vazio.png",
    locked: "/game-assets/icons/plots/canteiro_bloqueado.png"
  },
  crops: {
    milho: "/game-assets/icons/crops/milho.png",
    trigo: "/game-assets/icons/crops/trigo.png",
    cenoura: "/game-assets/icons/crops/cenoura.png",
    morango: "/game-assets/icons/crops/morango.png",
    tomate: "/game-assets/icons/crops/tomate.png",
    batata: "/game-assets/icons/crops/batata.png",
    cafe: "/game-assets/icons/crops/cafe.png"
  },
  seeds: {
    milho: "/game-assets/icons/seeds/semente_milho.png",
    trigo: "/game-assets/icons/seeds/semente_trigo.png",
    cenoura: "/game-assets/icons/seeds/semente_cenoura.png",
    morango: "/game-assets/icons/seeds/semente_morango.png",
    tomate: "/game-assets/icons/seeds/semente_tomate.png",
    batata: "/game-assets/icons/seeds/semente_batata.png"
  },
  animals: {
    cow: "/game-assets/icons/animals/vaca.png",
    chicken: "/game-assets/icons/animals/galinha.png",
    horse: "/game-assets/icons/animals/cavalo.png",
    pig: "/game-assets/icons/animals/porco.png",
    piglet: "/game-assets/icons/animals/leitao.png"
  },
  animalProducts: {
    egg: "/game-assets/icons/animal-products/ovo.png",
    milk: "/game-assets/icons/animal-products/leite.png",
    honey: "/game-assets/icons/animal-products/mel.png"
  },
  processed: {
    flour: "/game-assets/icons/processed/farinha.png",
    bread: "/game-assets/icons/processed/pao.png",
    cheese: "/game-assets/icons/processed/queijo.png"
  },
  actions: {
    plant: "/game-assets/icons/actions/plantar.png",
    harvest: "/game-assets/icons/actions/colher.png",
    discard: "/game-assets/icons/actions/descartar.png",
    scare: "/game-assets/icons/actions/espantar.png"
  },
  ui: {
    inventory: "/game-assets/icons/ui/inventario.png",
    ranking: "/game-assets/icons/ui/ranking.png",
    level: "/game-assets/icons/ui/nivel.png",
    xp: "/game-assets/icons/ui/xp.png",
    coins: "/game-assets/icons/ui/moedas.png",
    collector: "/game-assets/icons/ui/colecionador.png"
  },
  market: {
    p2p: "/game-assets/icons/market/anuncio_p2p.png"
  },
  community: {
    boost: "/game-assets/icons/community/boost_comunitario.png",
    goal: "/game-assets/icons/community/meta_comunitaria.png",
    farmerBox: "/game-assets/icons/community/caixa_fazendeiro.png",
    harvestBox: "/game-assets/icons/community/caixa_colheita.png"
  },
  events: {
    wolf: "/game-assets/icons/events/evento_lobo.png"
  },
  rare: {
    nugget: "/game-assets/icons/rare/pepita.png",
    shinyStone: "/game-assets/icons/rare/pedra_brilhante.png",
    ancientBone: "/game-assets/icons/rare/osso_antigo.png",
    leafFossil: "/game-assets/icons/rare/fossil_folha.png",
    ancientCoin: "/game-assets/icons/rare/moeda_antiga.png",
    cosmicCrystal: "/game-assets/icons/rare/cristal_cosmico.png"
  },
  quality: {
    common: "/game-assets/icons/quality/qualidade_comum.png",
    good: "/game-assets/icons/quality/qualidade_boa.png",
    excellent: "/game-assets/icons/quality/qualidade_excelente.png",
    extraordinary: "/game-assets/icons/quality/qualidade_extraordinaria.png",
    rotten: "/game-assets/icons/quality/qualidade_apodrecida.png",
    rottenItem: "/game-assets/icons/quality/item_apodrecido.png"
  },
  equipment: {
    tractor: "/game-assets/icons/equipment/trator.png"
  },
  supplies: {
    feed: "/game-assets/icons/supplies/racao.png",
    hay: "/game-assets/icons/supplies/feno.png"
  }
} as const;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const itemIconRules: Array<[RegExp, string]> = [
  [/semente.*milho|milho.*semente/, FARM_ICONS.seeds.milho],
  [/semente.*trigo|trigo.*semente/, FARM_ICONS.seeds.trigo],
  [/semente.*cenoura|cenoura.*semente/, FARM_ICONS.seeds.cenoura],
  [/semente.*morango|morango.*semente/, FARM_ICONS.seeds.morango],
  [/semente.*tomate|tomate.*semente/, FARM_ICONS.seeds.tomate],
  [/semente.*batata|batata.*semente/, FARM_ICONS.seeds.batata],
  [/milho/, FARM_ICONS.crops.milho],
  [/trigo/, FARM_ICONS.crops.trigo],
  [/cenoura/, FARM_ICONS.crops.cenoura],
  [/morango/, FARM_ICONS.crops.morango],
  [/tomate/, FARM_ICONS.crops.tomate],
  [/batata/, FARM_ICONS.crops.batata],
  [/cafe/, FARM_ICONS.crops.cafe],
  [/ovo/, FARM_ICONS.animalProducts.egg],
  [/leite/, FARM_ICONS.animalProducts.milk],
  [/mel/, FARM_ICONS.animalProducts.honey],
  [/farinha/, FARM_ICONS.processed.flour],
  [/pao/, FARM_ICONS.processed.bread],
  [/queijo/, FARM_ICONS.processed.cheese],
  [/racao/, FARM_ICONS.supplies.feed],
  [/feno/, FARM_ICONS.supplies.hay],
  [/pepita/, FARM_ICONS.rare.nugget],
  [/pedra.*brilhante/, FARM_ICONS.rare.shinyStone],
  [/osso.*antigo/, FARM_ICONS.rare.ancientBone],
  [/fossil.*folha/, FARM_ICONS.rare.leafFossil],
  [/moeda.*antiga/, FARM_ICONS.rare.ancientCoin],
  [/cristal.*cosmico/, FARM_ICONS.rare.cosmicCrystal]
];

export function iconForItemName(name: string): string {
  const normalized = normalize(name);
  return itemIconRules.find(([pattern]) => pattern.test(normalized))?.[1]
    ?? FARM_ICONS.ui.inventory;
}

export function iconForCropName(name?: string | null): string {
  const normalized = normalize(name ?? "");
  if (normalized.includes("trigo")) return FARM_ICONS.crops.trigo;
  if (normalized.includes("cenoura")) return FARM_ICONS.crops.cenoura;
  if (normalized.includes("morango")) return FARM_ICONS.crops.morango;
  if (normalized.includes("tomate")) return FARM_ICONS.crops.tomate;
  if (normalized.includes("batata")) return FARM_ICONS.crops.batata;
  if (normalized.includes("cafe")) return FARM_ICONS.crops.cafe;
  return FARM_ICONS.crops.milho;
}

export function iconForQuality(
  quality: "NONE" | "COMMON" | "GOOD" | "EXCELLENT" | "EXTRAORDINARY" | "ROTTEN"
): string | null {
  switch (quality) {
    case "NONE": return null;
    case "COMMON": return FARM_ICONS.quality.common;
    case "GOOD": return FARM_ICONS.quality.good;
    case "EXCELLENT": return FARM_ICONS.quality.excellent;
    case "EXTRAORDINARY": return FARM_ICONS.quality.extraordinary;
    case "ROTTEN": return FARM_ICONS.quality.rotten;
  }
}

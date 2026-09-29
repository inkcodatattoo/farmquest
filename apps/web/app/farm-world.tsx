"use client";

import { useMemo, useState } from "react";
import {
  FARM_ICONS,
  iconForCropName,
  iconForItemName,
  iconForQuality
} from "./farm-icons";

export type FarmWorldFarm = {
  id: string;
  level: number;
  xp: string;
  coins: string;
  inventorySlots: number;
};

export type FarmWorldPlot = {
  id: string;
  slotNumber: number;
  seedsCapacity: number;
  state: "EMPTY" | "PLANTED" | "READY" | "ROTTEN";
  planted: null | {
    cropName: string;
    seedCount: number;
    growsAt: string;
    rotsAt: string;
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

type Section =
  | "inicio"
  | "fazenda"
  | "plantacoes"
  | "animais"
  | "celeiro"
  | "mercado"
  | "pedidos"
  | "comunidade"
  | "exploracao"
  | "ranking"
  | "conquistas";

type Props = {
  userName: string;
  farm: FarmWorldFarm;
  plots: FarmWorldPlot[];
  inventory: FarmWorldInventoryItem[];
  shop: FarmWorldShopOffer[];
  cooldownText: string;
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

type PixelIconProps = {
  src: string;
  alt?: string;
  className?: string;
};

function PixelIcon({ src, alt = "", className = "" }: PixelIconProps) {
  return (
    <img
      className={`fq-pixel-icon ${className}`.trim()}
      src={src}
      alt={alt}
      draggable={false}
    />
  );
}

const menu: Array<{ key: Section; label: string; icon: string }> = [
  { key: "inicio", label: "Início", icon: FARM_ICONS.buildings.farmhouse },
  { key: "fazenda", label: "Fazenda", icon: FARM_ICONS.plots.empty },
  { key: "plantacoes", label: "Plantações", icon: FARM_ICONS.actions.plant },
  { key: "animais", label: "Animais", icon: FARM_ICONS.animals.chicken },
  { key: "celeiro", label: "Celeiro", icon: FARM_ICONS.buildings.barn },
  { key: "mercado", label: "Mercado", icon: FARM_ICONS.buildings.market },
  { key: "pedidos", label: "Pedidos", icon: FARM_ICONS.community.harvestBox },
  { key: "comunidade", label: "Comunidade", icon: FARM_ICONS.community.goal },
  { key: "exploracao", label: "Exploração", icon: FARM_ICONS.rare.leafFossil },
  { key: "ranking", label: "Ranking", icon: FARM_ICONS.ui.ranking },
  { key: "conquistas", label: "Conquistas", icon: FARM_ICONS.ui.collector }
];

function plotState(plot: FarmWorldPlot, nowMs: number): FarmWorldPlot["state"] {
  if (!plot.planted) return "EMPTY";
  if (nowMs >= Date.parse(plot.planted.rotsAt)) return "ROTTEN";
  if (nowMs >= Date.parse(plot.planted.growsAt)) return "READY";
  return "PLANTED";
}

function timerText(plot: FarmWorldPlot, nowMs: number): string {
  if (!plot.planted) return "";
  const ms = Date.parse(plot.planted.growsAt) - nowMs;
  if (ms <= 0) return "Pronto";
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function qualityLabel(quality: FarmWorldInventoryItem["quality"]): string {
  switch (quality) {
    case "NONE": return "Sem qualidade";
    case "COMMON": return "Comum";
    case "GOOD": return "Boa";
    case "EXCELLENT": return "Excelente";
    case "EXTRAORDINARY": return "Extraordinário";
    case "ROTTEN": return "Apodrecido";
  }
}

function plotIcon(plot: FarmWorldPlot, nowMs: number): string {
  const state = plotState(plot, nowMs);
  if (state === "EMPTY") return FARM_ICONS.plots.empty;
  if (state === "ROTTEN") return FARM_ICONS.quality.rottenItem;
  return iconForCropName(plot.planted?.cropName);
}

export function FarmWorld(props: Props) {
  const {
    userName,
    farm,
    plots,
    inventory,
    shop,
    cooldownText,
    nowMs,
    busy,
    notice,
    error
  } = props;

  const [section, setSection] = useState<Section>("inicio");

  const inventoryCount = useMemo(
    () => inventory.reduce((sum, item) => sum + item.quantity, 0),
    [inventory]
  );

  function interactPlot(plot: FarmWorldPlot) {
    const state = plotState(plot, nowMs);
    if (state === "EMPTY") props.onPlantPlot(plot.id);
    if (state === "READY" || state === "ROTTEN") props.onHarvestPlot(plot.id);
  }

  function homeScene() {
    const activePlots = plots.slice(0, 3);
    const readyCount = activePlots.filter((plot) => plotState(plot, nowMs) === "READY").length;
    const seedCount = inventory
      .filter((item) => item.name.toLowerCase().includes("semente"))
      .reduce((sum, item) => sum + item.quantity, 0);
    const xpValue = Number(farm.xp) || 0;
    const xpGoal = farm.level <= 1 ? 100 : farm.level === 2 ? 200 : Math.max(300, farm.level * 100);
    const xpProgress = Math.max(0, Math.min(100, (xpValue / xpGoal) * 100));

    const sidebarItems: Array<{ section: Section; label: string; className: string }> = [
      { section: "inicio", label: "Início", className: "fq-map-nav-inicio" },
      { section: "plantacoes", label: "Plantações", className: "fq-map-nav-plantacoes" },
      { section: "animais", label: "Animais", className: "fq-map-nav-animais" },
      { section: "celeiro", label: "Celeiro", className: "fq-map-nav-celeiro" },
      { section: "mercado", label: "Mercado", className: "fq-map-nav-mercado" },
      { section: "comunidade", label: "Comunidade", className: "fq-map-nav-comunidade" },
      { section: "ranking", label: "Ranking", className: "fq-map-nav-ranking" }
    ];

    return (
      <section className="fq-official-home-stage">
        <div className="fq-official-home-map">
          <img
            className="fq-official-home-art"
            src="/game-assets/home/farmquest-home-official.webp"
            alt="Fazenda principal FarmQuest"
            draggable={false}
          />

          <nav className="fq-map-nav" aria-label="Navegação da Home">
            {sidebarItems.map((item) => (
              <button
                key={item.section}
                className={`fq-map-hotspot fq-map-nav-button ${item.className}`}
                onClick={() => setSection(item.section)}
                aria-label={item.label}
                title={item.label}
              />
            ))}
          </nav>

          <button
            className="fq-map-hotspot fq-map-house-hotspot"
            onClick={() => setSection("plantacoes")}
            aria-label="Casa da fazenda"
            title="Casa da fazenda"
          />
          <button
            className="fq-map-hotspot fq-map-barn-hotspot"
            onClick={() => setSection("celeiro")}
            aria-label="Celeiro"
            title="Abrir celeiro"
          />
          <button
            className="fq-map-hotspot fq-map-cow-hotspot"
            onClick={() => setSection("animais")}
            aria-label="Curral da vaca"
            title="Abrir animais"
          />
          <button
            className="fq-map-hotspot fq-map-coop-hotspot"
            onClick={() => setSection("animais")}
            aria-label="Galinheiro"
            title="Abrir galinheiro"
          />

          <div className="fq-map-active-plots" aria-label="3 canteiros iniciais">
            {activePlots.map((plot, index) => {
              const state = plotState(plot, nowMs);
              const canInteract = state === "EMPTY" || state === "READY" || state === "ROTTEN";
              return (
                <button
                  key={plot.id}
                  className={`fq-map-plot fq-map-plot-${index + 1} is-${state.toLowerCase()}`}
                  onClick={() => interactPlot(plot)}
                  disabled={
                    Boolean(busy) ||
                    !canInteract ||
                    (state !== "EMPTY" && cooldownText !== "Livre")
                  }
                  title={
                    state === "EMPTY"
                      ? `Canteiro ${index + 1}: plantar`
                      : state === "PLANTED"
                        ? `Canteiro ${index + 1}: crescendo ${timerText(plot, nowMs)}`
                        : state === "READY"
                          ? `Canteiro ${index + 1}: colher`
                          : `Canteiro ${index + 1}: apodrecido`
                  }
                >
                  <PixelIcon
                    src={FARM_ICONS.plots.empty}
                    alt=""
                    className="fq-map-plot-base"
                  />
                  {state !== "EMPTY" ? (
                    <PixelIcon
                      src={plotIcon(plot, nowMs)}
                      alt={plot.planted?.cropName ?? ""}
                      className="fq-map-plot-crop"
                    />
                  ) : null}
                  {state === "PLANTED" ? (
                    <span className="fq-map-plot-timer">{timerText(plot, nowMs)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="fq-map-locked-plots" aria-label="Canteiros bloqueados">
            {Array.from({ length: 7 }, (_, index) => (
              <button
                key={index}
                className={`fq-map-locked-plot fq-map-locked-${index + 1}`}
                disabled
                aria-label={`Canteiro bloqueado ${index + 4}. Será desbloqueado por nível.`}
                title="Bloqueado — será desbloqueado por nível"
              />
            ))}
          </div>

          <button
            className="fq-map-hotspot fq-map-plant-all"
            onClick={props.onPlantAll}
            disabled={Boolean(busy)}
            aria-label="Plantar nos canteiros disponíveis"
            title="Plantar"
          />
          <button
            className="fq-map-hotspot fq-map-harvest-all"
            onClick={props.onHarvestAll}
            disabled={Boolean(busy) || cooldownText !== "Livre"}
            aria-label="Colher canteiros prontos"
            title="Colher"
          />

          <button
            className="fq-map-hotspot fq-map-refresh"
            onClick={props.onRefresh}
            disabled={Boolean(busy)}
            aria-label="Atualizar fazenda"
            title="Atualizar"
          />
          <button
            className="fq-map-hotspot fq-map-logout"
            onClick={props.onLogout}
            disabled={Boolean(busy)}
            aria-label="Sair"
            title="Sair"
          />

          <div className="fq-map-live-coins" aria-label={`${farm.coins} moedas`}>
            <strong>{farm.coins}</strong>
          </div>

          <div className="fq-map-live-xp" aria-label={`${xpValue} de ${xpGoal} de experiência`}>
            <span className="fq-map-live-xp-track">
              <i style={{ width: `${xpProgress}%` }} />
            </span>
            <strong>{xpValue}/{xpGoal}</strong>
          </div>

          <div className="fq-map-live-farm-name">
            <strong>Fazenda do {userName}</strong>
          </div>

          <div className="fq-map-live-level" aria-label={`Nível ${farm.level}`}>
            <strong>{farm.level}</strong>
          </div>

          <div
            className="fq-map-live-tasks"
            aria-label={`3 canteiros, ${seedCount} sementes, ${readyCount} ${readyCount === 1 ? "colheita pronta" : "colheitas prontas"}`}
          >
            <span><strong>3</strong></span>
            <span><strong>{seedCount}</strong></span>
            <span><strong>{readyCount}</strong></span>
          </div>
        </div>
      </section>
    );
  }

  function plantations() {
    return (
      <section className="game-page-panel">
        <div className="game-page-heading">
          <div>
            <span>PLANTAÇÕES</span>
            <h2>Seus canteiros</h2>
            <p>Plante milho, acompanhe o crescimento e colha direto daqui.</p>
          </div>
          <div className="game-page-actions">
            <button
              className="game-action secondary icon-action"
              onClick={props.onPlantAll}
              disabled={Boolean(busy)}
            >
              <PixelIcon src={FARM_ICONS.actions.plant} alt="" />
              {busy === "plant-all" ? "Plantando..." : "Plantar milho"}
            </button>
            <button
              className="game-action icon-action"
              onClick={props.onHarvestAll}
              disabled={Boolean(busy) || cooldownText !== "Livre"}
            >
              <PixelIcon src={FARM_ICONS.actions.harvest} alt="" />
              {busy === "harvest-all" ? "Colhendo..." : "Colher tudo"}
            </button>
          </div>
        </div>

        <div className="game-plot-grid">
          {plots.map((plot) => {
            const state = plotState(plot, nowMs);
            return (
              <article key={plot.id} className={`game-plot-card is-${state.toLowerCase()}`}>
                <div className="game-plot-topline">
                  <strong>Canteiro {plot.slotNumber}</strong>
                  <span>{state === "EMPTY" ? "Vazio" : state === "PLANTED" ? "Crescendo" : state === "READY" ? "Pronto" : "Apodrecido"}</span>
                </div>
                <div className="game-plot-art pixel-game-plot-art">
                  <PixelIcon src={plotIcon(plot, nowMs)} alt={plot.planted?.cropName ?? "Canteiro vazio"} />
                </div>
                <div className="game-plot-info">
                  <strong>{plot.planted?.cropName ?? "Terreno livre"}</strong>
                  <small>
                    {state === "PLANTED"
                      ? `Pronto em ${timerText(plot, nowMs)}`
                      : state === "EMPTY"
                        ? `Capacidade: ${plot.seedsCapacity}`
                        : state === "READY"
                          ? "Pronto para colher"
                          : "Colheita apodrecida"}
                  </small>
                </div>
                <button
                  className="game-action wide icon-action centered"
                  onClick={() => interactPlot(plot)}
                  disabled={
                    Boolean(busy) ||
                    state === "PLANTED" ||
                    ((state === "READY" || state === "ROTTEN") && cooldownText !== "Livre")
                  }
                >
                  <PixelIcon
                    src={state === "EMPTY" ? FARM_ICONS.actions.plant : FARM_ICONS.actions.harvest}
                    alt=""
                  />
                  {state === "EMPTY"
                    ? busy === `plant-${plot.id}` ? "Plantando..." : "Plantar"
                    : state === "PLANTED"
                      ? "Crescendo..."
                      : busy === `harvest-${plot.id}` ? "Colhendo..." : "Colher"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function barn() {
    return (
      <section className="game-page-panel">
        <div className="game-page-heading">
          <div>
            <span>CELEIRO</span>
            <h2>Inventário</h2>
            <p>{inventoryCount} itens armazenados · {farm.inventorySlots} slots disponíveis no protótipo.</p>
          </div>
        </div>

        <div className="game-inventory-grid">
          {inventory.length === 0 ? (
            <div className="game-empty-state pixel-empty-state">
              <PixelIcon src={FARM_ICONS.ui.inventory} alt="Inventário vazio" />
              <strong>Seu celeiro está vazio</strong>
              <span>Colha uma plantação para guardar produtos aqui.</span>
            </div>
          ) : (
            inventory.map((item) => {
              const qualityIcon = iconForQuality(item.quality);
              return (
                <article key={item.id} className={`game-inventory-card q-${item.quality.toLowerCase()}`}>
                  <div className="game-item-art pixel-item-art">
                    <PixelIcon src={iconForItemName(item.name)} alt={item.name} />
                  </div>
                  <div className="game-item-copy">
                    <strong>{item.name}</strong>
                    <span className="pixel-quality-line">
                      {qualityIcon ? <PixelIcon src={qualityIcon} alt="" className="quality-pixel-icon" /> : null}
                      {qualityLabel(item.quality)}
                    </span>
                    <small>Quantidade: {item.quantity}</small>
                  </div>
                  <div className="game-item-actions">
                    {item.quality !== "NONE" && item.quality !== "ROTTEN" ? (
                      <button
                        className="game-mini-action sell"
                        onClick={() => props.onSell(item.id)}
                        disabled={Boolean(busy)}
                      >
                        {busy === `sell-${item.id}` ? "Vendendo..." : "Vender 1"}
                      </button>
                    ) : null}
                    <button
                      className="game-mini-action icon-action compact"
                      onClick={() => props.onDiscard(item.id)}
                      disabled={Boolean(busy)}
                    >
                      <PixelIcon src={FARM_ICONS.actions.discard} alt="" />
                      {busy === `discard-${item.id}` ? "Descartando..." : "Descartar 1"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    );
  }

  function market() {
    return (
      <section className="game-page-panel">
        <div className="game-page-heading">
          <div>
            <span>MERCADO RURAL · PROVISÓRIO</span>
            <h2>Loja da fazenda</h2>
            <p>Compre suprimentos usando suas moedas.</p>
          </div>
        </div>

        <div className="game-shop-grid">
          {shop.map((offer) => (
            <article key={offer.id} className="game-shop-card">
              <div className="game-shop-art pixel-item-art">
                <PixelIcon src={iconForItemName(offer.itemName)} alt={offer.itemName} />
              </div>
              <div className="game-item-copy">
                <strong>{offer.itemName}</strong>
                <span>Nível mínimo {offer.minLevel}</span>
              </div>
              <div className="game-shop-buy">
                <strong className="pixel-price">
                  <PixelIcon src={FARM_ICONS.ui.coins} alt="" />
                  {offer.buyPrice} moedas
                </strong>
                <button
                  className="game-action"
                  onClick={() => props.onBuy(offer.id)}
                  disabled={Boolean(busy)}
                >
                  {busy === `buy-${offer.id}` ? "Comprando..." : "Comprar 1"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function animalsPage() {
    return (
      <section className="game-page-panel fq-feature-page">
        <div className="game-page-heading">
          <div>
            <span>ANIMAIS</span>
            <h2>Área dos animais</h2>
            <p>Prévia visual do sistema de produção animal que entra nas próximas fases.</p>
          </div>
        </div>

        <div className="fq-feature-grid fq-animal-grid">
          <article className="fq-feature-card">
            <PixelIcon src={FARM_ICONS.animals.chicken} alt="Galinha" className="fq-feature-main-icon" />
            <h3>Galinhas</h3>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.supplies.feed} alt="" />
              <span>Ração: <strong>20 moedas</strong></span>
            </div>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.animalProducts.egg} alt="" />
              <span>1 ovo a cada <strong>2 horas</strong></span>
            </div>
            <small>Acumula até 3 ovos antes da coleta.</small>
            <span className="fq-coming-soon">Sistema ainda não conectado</span>
          </article>

          <article className="fq-feature-card">
            <PixelIcon src={FARM_ICONS.animals.cow} alt="Vaca" className="fq-feature-main-icon" />
            <h3>Vacas</h3>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.supplies.hay} alt="" />
              <span>Feno: <strong>20 moedas</strong></span>
            </div>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.animalProducts.milk} alt="" />
              <span>1 leite a cada <strong>3 horas</strong></span>
            </div>
            <small>Armazena 1 produção por vez e não apodrece.</small>
            <span className="fq-coming-soon">Sistema ainda não conectado</span>
          </article>
        </div>
      </section>
    );
  }

  function communityPage() {
    return (
      <section className="game-page-panel fq-feature-page">
        <div className="game-page-heading">
          <div>
            <span>COMUNIDADE</span>
            <h2>Fazenda Comunitária</h2>
            <p>Prévia visual da meta compartilhada do canal.</p>
          </div>
        </div>

        <div className="fq-community-layout">
          <article className="fq-feature-card fq-community-goal-card">
            <PixelIcon src={FARM_ICONS.community.goal} alt="Meta comunitária" className="fq-feature-main-icon" />
            <h3>Meta da semana</h3>
            <div className="fq-community-product">
              <PixelIcon src={FARM_ICONS.crops.milho} alt="Milho" />
              <div>
                <strong>Milho</strong>
                <span>Item rotativo semanal</span>
              </div>
            </div>
            <div className="fq-community-progress" aria-label="Meta comunitária em desenvolvimento">
              <span style={{ width: "5%" }} />
            </div>
            <small>Contribuição automática prevista: 5% das colheitas.</small>
          </article>

          <article className="fq-feature-card">
            <PixelIcon src={FARM_ICONS.community.boost} alt="Boost comunitário" className="fq-feature-main-icon" />
            <h3>Recompensa coletiva</h3>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.actions.harvest} alt="" />
              <span><strong>-5s</strong> no cooldown de colheita</span>
            </div>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.community.farmerBox} alt="" />
              <span>Caixa de Fazendeiro para contribuintes</span>
            </div>
            <small>O boost permanece ativo por 2 dias após a meta.</small>
            <span className="fq-coming-soon">Sistema ainda não conectado</span>
          </article>
        </div>
      </section>
    );
  }

  function rankingPage() {
    return (
      <section className="game-page-panel fq-feature-page">
        <div className="game-page-heading">
          <div>
            <span>RANKING</span>
            <h2>Classificação dos fazendeiros</h2>
            <p>Estrutura visual pronta para receber os dados reais do ranking.</p>
          </div>
        </div>

        <div className="fq-ranking-board">
          <div className="fq-ranking-hero">
            <PixelIcon src={FARM_ICONS.ui.ranking} alt="Ranking" />
            <strong>Ranking FarmQuest</strong>
            <span>Os dados entram no MVP 1.0.</span>
          </div>
          {[1, 2, 3, 4, 5].map((position) => (
            <div className="fq-ranking-row" key={position}>
              <strong>#{position}</strong>
              <span>—</span>
              <small>Aguardando classificação</small>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function unavailable(title: string, text: string, icon: string) {
    return (
      <section className="game-page-panel future-panel pixel-future-panel">
        <div className="future-icon pixel-future-icon">
          <PixelIcon src={icon} alt="" />
        </div>
        <span>EM DESENVOLVIMENTO</span>
        <h2>{title}</h2>
        <p>{text}</p>
        <button className="game-action" onClick={() => setSection("inicio")}>
          Voltar para a fazenda
        </button>
      </section>
    );
  }

  function content() {
    switch (section) {
      case "inicio":
      case "fazenda":
        return homeScene();
      case "plantacoes":
        return plantations();
      case "celeiro":
        return barn();
      case "mercado":
        return market();
      case "animais":
        return animalsPage();
      case "pedidos":
        return unavailable(
          "Pedidos",
          "A navegação está pronta. Os pedidos serão ativados quando o módulo correspondente entrar no protótipo.",
          FARM_ICONS.community.harvestBox
        );
      case "comunidade":
        return communityPage();
      case "exploracao":
        return unavailable(
          "Exploração",
          "A área visual já existe, mas nenhuma regra de exploração foi adicionada ao 0.1.",
          FARM_ICONS.rare.leafFossil
        );
      case "ranking":
        return rankingPage();
      case "conquistas":
        return unavailable(
          "Conquistas",
          "Esta tela ficará responsável por títulos e conquistas quando esses dados estiverem disponíveis.",
          FARM_ICONS.ui.collector
        );
    }
  }

  const isHome = section === "inicio" || section === "fazenda";

  if (isHome) {
    return (
      <main className="fq-home-shell">
        {notice ? <div className="game-toast success fq-home-toast">{notice}</div> : null}
        {error ? <div className="game-toast error fq-home-toast">{error}</div> : null}
        {homeScene()}
      </main>
    );
  }

  return (
    <main className="farm-game-shell pixel-ui-shell">
      <header className="farm-game-topbar">
        <div className="farm-game-logo pixel-logo">
          <img
            className="farm-game-brand-logo"
            src="/game-assets/brand/farmquest-logo.png"
            alt="FarmQuest"
            draggable={false}
          />
        </div>

        <div className="farm-identity">
          <strong>Fazenda de {userName}</strong>
          <span>Nível {farm.level} · {farm.xp} XP</span>
        </div>

        <div className="farm-resources">
          <div className="resource-chip coin-chip">
            <span className="resource-symbol pixel-resource-symbol">
              <PixelIcon src={FARM_ICONS.ui.coins} alt="Moedas" />
            </span>
            <strong>{farm.coins}</strong>
            <small>moedas</small>
          </div>
          <div className="resource-chip">
            <span className="resource-symbol pixel-resource-symbol">
              <PixelIcon src={FARM_ICONS.ui.xp} alt="Experiência" />
            </span>
            <strong>{farm.xp}</strong>
            <small>experiência</small>
          </div>
          <div className="resource-chip">
            <span className="resource-symbol pixel-resource-symbol">
              <PixelIcon src={FARM_ICONS.actions.harvest} alt="Colheita" />
            </span>
            <strong>{cooldownText}</strong>
            <small>colheita</small>
          </div>
        </div>

        <div className="farm-system-actions">
          <button onClick={props.onRefresh} disabled={Boolean(busy)} title="Atualizar">↻</button>
          <button onClick={props.onLogout} disabled={Boolean(busy)} title="Sair">×</button>
        </div>
      </header>

      <aside className="farm-game-sidebar">
        <div className="sidebar-brand-mini pixel-sidebar-brand">
          <PixelIcon src={FARM_ICONS.ui.level} alt="FarmQuest" />
        </div>
        <nav>
          {menu.map((item) => (
            <button
              key={item.key}
              className={section === item.key ? "active" : ""}
              onClick={() => setSection(item.key)}
              aria-label={item.label}
            >
              <span className="pixel-nav-icon"><PixelIcon src={item.icon} alt="" /></span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>
      </aside>

      <section className="farm-game-stage">
        {notice ? <div className="game-toast success">{notice}</div> : null}
        {error ? <div className="game-toast error">{error}</div> : null}
        {content()}
      </section>

      <footer className="farm-game-dock">
        <button onClick={() => setSection("inicio")}>
          <span className="pixel-dock-icon"><PixelIcon src={FARM_ICONS.buildings.farmhouse} alt="" /></span>
          <strong>Fazenda</strong>
          <small>Início</small>
        </button>
        <button onClick={() => setSection("celeiro")}>
          <span className="pixel-dock-icon"><PixelIcon src={FARM_ICONS.ui.inventory} alt="" /></span>
          <strong>Inventário</strong>
          <small>{inventoryCount} itens</small>
        </button>
        <button onClick={() => setSection("mercado")}>
          <span className="pixel-dock-icon"><PixelIcon src={FARM_ICONS.buildings.market} alt="" /></span>
          <strong>Mercado</strong>
          <small>Comprar</small>
        </button>
        <button onClick={() => setSection("animais")}>
          <span className="pixel-dock-icon"><PixelIcon src={FARM_ICONS.animals.cow} alt="" /></span>
          <strong>Animais</strong>
          <small>Fazenda</small>
        </button>
        <button onClick={() => setSection("comunidade")}>
          <span className="pixel-dock-icon"><PixelIcon src={FARM_ICONS.community.goal} alt="" /></span>
          <strong>Comunidade</strong>
          <small>Cooperativo</small>
        </button>
        <button onClick={() => setSection("ranking")}>
          <span className="pixel-dock-icon"><PixelIcon src={FARM_ICONS.ui.ranking} alt="" /></span>
          <strong>Ranking</strong>
          <small>Classificação</small>
        </button>
      </footer>
    </main>
  );
}

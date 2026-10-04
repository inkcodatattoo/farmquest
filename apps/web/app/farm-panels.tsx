"use client";

import {
  FARM_ICONS,
  iconForItemName,
  iconForQuality
} from "./farm-icons";
import { PixelIcon } from "./farm-plot";
import {
  buildFarmPlotSlots,
  iconForPlot,
  plotStateLabel,
  qualityLabel,
  resolvePlotState,
  timerText,
  type FarmWorldProps,
  type Section
} from "./farm-world-model";

export type FarmPanelsProps = FarmWorldProps & {
  section: Section;
  onSectionChange: (section: Section) => void;
};
function cowCountdownText(
  readyAt: string | null,
  nowMs: number
): string {
  if (!readyAt) return "00:00:00";

  const remaining = Date.parse(readyAt) - nowMs;

  if (remaining <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.ceil(remaining / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    hours,
    minutes,
    seconds
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function FarmPanels(props: FarmPanelsProps) {
  const {
    farm,
    plots,
    inventory,
    shop,
    nowMs,
    busy,
    canHarvest,
    section,
    onSectionChange
  } = props;

  const inventoryCount = inventory.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  function interactPlot(plot: FarmWorldProps["plots"][number]) {
    const state = resolvePlotState(plot, nowMs);

    if (state === "AVAILABLE") props.onPlantPlot(plot.id);
    if (state === "READY" || state === "ROTTEN") {
      props.onHarvestPlot(plot.id);
    }
  }

  function plantations() {
    const plotSlots = buildFarmPlotSlots(plots, nowMs, 15);

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
              disabled={Boolean(busy) || !canHarvest}
            >
              <PixelIcon src={FARM_ICONS.actions.harvest} alt="" />
              {busy === "harvest-all" ? "Colhendo..." : "Colher tudo"}
            </button>
          </div>
        </div>

        <div className="game-plot-grid">
          {plotSlots.map((slot) => {
            const { plot, state } = slot;
            const isLocked = state === "LOCKED" || !plot;
            const isAvailable = state === "AVAILABLE";
            const isGrowing = state === "PLANTED";
            const isHarvestable = state === "READY" || state === "ROTTEN";
            const plotIcon = isLocked
              ? FARM_ICONS.plots.locked
              : isAvailable
                ? FARM_ICONS.plots.empty
                : iconForPlot(plot, nowMs);
            const plotName = isLocked
              ? "Canteiro bloqueado"
              : plot?.planted?.cropName ?? "Terreno livre";

            return (
              <article
                key={slot.slotNumber}
                className={`game-plot-card is-${state.toLowerCase()}`}
              >
                <div className="game-plot-topline">
                  <strong>Canteiro {slot.slotNumber}</strong>
                  <span>{plotStateLabel(state)}</span>
                </div>
                <div className="game-plot-art pixel-game-plot-art">
                  <PixelIcon src={plotIcon} alt={plotName} />
                </div>
                <div className="game-plot-info">
                  <strong>{plotName}</strong>
                  <small>
                    {isLocked
                      ? "Indisponível no momento"
                      : isGrowing && plot
                        ? `Pronto em ${timerText(plot, nowMs)}`
                        : isAvailable && plot
                          ? `Capacidade: ${plot.seedsCapacity}`
                          : state === "READY"
                            ? "Pronto para colher"
                            : "Colheita apodrecida"}
                  </small>
                </div>
                <button
                  className="game-action wide icon-action centered"
                  onClick={plot ? () => interactPlot(plot) : undefined}
                  disabled={
                    Boolean(busy) ||
                    isLocked ||
                    isGrowing ||
                    (isHarvestable && !canHarvest)
                  }
                >
                  <PixelIcon
                    src={
                      isLocked
                        ? FARM_ICONS.plots.locked
                        : isAvailable
                          ? FARM_ICONS.actions.plant
                          : FARM_ICONS.actions.harvest
                    }
                    alt=""
                  />
                  {isLocked
                    ? "Bloqueado"
                    : isAvailable
                      ? busy === `plant-${plot?.id}`
                        ? "Plantando..."
                        : "Plantar"
                      : isGrowing
                        ? "Crescendo..."
                        : busy === `harvest-${plot?.id}`
                          ? "Colhendo..."
                          : "Colher"}
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
            <p>
              {inventoryCount} itens armazenados · {farm.inventorySlots} slots
              disponíveis no protótipo.
            </p>
          </div>
        </div>

        <div className="game-inventory-grid">
          {inventory.length === 0 ? (
            <div className="game-empty-state pixel-empty-state">
              <PixelIcon
                src={FARM_ICONS.ui.inventory}
                alt="Inventário vazio"
              />
              <strong>Seu celeiro está vazio</strong>
              <span>Colha uma plantação para guardar produtos aqui.</span>
            </div>
          ) : (
            inventory.map((item) => {
              const qualityIcon = iconForQuality(item.quality);

              return (
                <article
                  key={item.id}
                  className={`game-inventory-card q-${item.quality.toLowerCase()}`}
                >
                  <div className="game-item-art pixel-item-art">
                    <PixelIcon
                      src={iconForItemName(item.name)}
                      alt={item.name}
                    />
                  </div>
                  <div className="game-item-copy">
                    <strong>{item.name}</strong>
                    <span className="pixel-quality-line">
                      {qualityIcon ? (
                        <PixelIcon
                          src={qualityIcon}
                          alt=""
                          className="quality-pixel-icon"
                        />
                      ) : null}
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
                      {busy === `discard-${item.id}`
                        ? "Descartando..."
                        : "Descartar 1"}
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
                <PixelIcon
                  src={iconForItemName(offer.itemName)}
                  alt={offer.itemName}
                />
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
            <p>
              Prévia visual do sistema de produção animal que entra nas próximas
              fases.
            </p>
          </div>
        </div>

        <div className="fq-feature-grid fq-animal-grid">
          <article className="fq-feature-card">
            <PixelIcon
              src={FARM_ICONS.animals.chicken}
              alt="Galinha"
              className="fq-feature-main-icon"
            />
            <h3>Galinhas</h3>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.supplies.feed} alt="" />
              <span>
                Ração: <strong>20 moedas</strong>
              </span>
            </div>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.animalProducts.egg} alt="" />
              <span>
                1 ovo a cada <strong>2 horas</strong>
              </span>
            </div>
            <small>Acumula até 3 ovos antes da coleta.</small>
            <span className="fq-coming-soon">Sistema ainda não conectado</span>
          </article>

          <article className="fq-feature-card">
            <PixelIcon
              src={FARM_ICONS.animals.cow}
              alt="Vaca"
              className="fq-feature-main-icon"
            />
            <h3>Vacas</h3>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.supplies.hay} alt="" />
              <span>
                Feno: <strong>20 moedas</strong>
              </span>
            </div>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.animalProducts.milk} alt="" />
              <span>
                1 leite a cada <strong>3 horas</strong>
              </span>
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
            <PixelIcon
              src={FARM_ICONS.community.goal}
              alt="Meta comunitária"
              className="fq-feature-main-icon"
            />
            <h3>Meta da semana</h3>
            <div className="fq-community-product">
              <PixelIcon src={FARM_ICONS.crops.milho} alt="Milho" />
              <div>
                <strong>Milho</strong>
                <span>Item rotativo semanal</span>
              </div>
            </div>
            <div
              className="fq-community-progress"
              aria-label="Meta comunitária em desenvolvimento"
            >
              <span style={{ width: "5%" }} />
            </div>
            <small>Contribuição automática prevista: 5% das colheitas.</small>
          </article>

          <article className="fq-feature-card">
            <PixelIcon
              src={FARM_ICONS.community.boost}
              alt="Boost comunitário"
              className="fq-feature-main-icon"
            />
            <h3>Recompensa coletiva</h3>
            <div className="fq-feature-stat">
              <PixelIcon src={FARM_ICONS.actions.harvest} alt="" />
              <span>
                <strong>-5s</strong> no cooldown de colheita
              </span>
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
        <button
          className="game-action"
          onClick={() => onSectionChange("inicio")}
        >
          Voltar para a fazenda
        </button>
      </section>
    );
  }

  switch (section) {
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
    case "inicio":
      return null;
  }
}

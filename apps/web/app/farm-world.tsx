"use client";

import { useMemo, useState } from "react";

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

const menu: Array<{ key: Section; label: string; icon: string }> = [
  { key: "inicio", label: "Início", icon: "⌂" },
  { key: "fazenda", label: "Fazenda", icon: "▦" },
  { key: "plantacoes", label: "Plantações", icon: "♧" },
  { key: "animais", label: "Animais", icon: "●" },
  { key: "celeiro", label: "Celeiro", icon: "□" },
  { key: "mercado", label: "Mercado", icon: "▤" },
  { key: "pedidos", label: "Pedidos", icon: "✓" },
  { key: "exploracao", label: "Exploração", icon: "⌖" },
  { key: "ranking", label: "Ranking", icon: "♛" },
  { key: "conquistas", label: "Conquistas", icon: "★" }
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
    return (
      <section className="world-scene-shell">
        <div className="world-scene">
          <div className="scene-tree tree-a" />
          <div className="scene-tree tree-b" />
          <div className="scene-tree tree-c" />
          <div className="scene-tree tree-d" />

          <button
            className="scene-building farmhouse"
            onClick={() => setSection("fazenda")}
            title="Fazenda"
          >
            <span className="house-roof" />
            <span className="house-body">
              <span className="house-door" />
              <span className="house-window house-window-a" />
              <span className="house-window house-window-b" />
            </span>
            <span className="scene-caption">Fazenda</span>
          </button>

          <button
            className="scene-building barn-building"
            onClick={() => setSection("celeiro")}
            title="Abrir celeiro"
          >
            <span className="barn-main">
              <span className="barn-big-door" />
            </span>
            <span className="barn-top" />
            <span className="scene-caption">Celeiro</span>
          </button>

          <button
            className="scene-building market-building"
            onClick={() => setSection("mercado")}
            title="Abrir mercado"
          >
            <span className="market-awning" />
            <span className="market-counter" />
            <span className="scene-caption">Mercado</span>
          </button>

          <button
            className="scene-building animal-pen"
            onClick={() => setSection("animais")}
            title="Animais"
          >
            <span className="pen-fence" />
            <span className="animal-dot animal-cow">●</span>
            <span className="animal-dot animal-chicken">●</span>
            <span className="scene-caption">Animais</span>
          </button>

          <div className="windmill" aria-hidden="true">
            <span className="windmill-tower" />
            <span className="windmill-hub" />
            <span className="windmill-blade blade-1" />
            <span className="windmill-blade blade-2" />
          </div>

          <div className="silo" aria-hidden="true">
            <span className="silo-cap" />
          </div>

          <div className="pond" aria-hidden="true">
            <span className="pond-shine pond-shine-a" />
            <span className="pond-shine pond-shine-b" />
          </div>

          <div className="stone-path path-a" />
          <div className="stone-path path-b" />

          <div className="scene-plots" aria-label="Canteiros da fazenda">
            {plots.map((plot) => {
              const state = plotState(plot, nowMs);
              const canInteract =
                state === "EMPTY" ||
                state === "READY" ||
                state === "ROTTEN";

              return (
                <button
                  key={plot.id}
                  className={`scene-plot scene-plot-${plot.slotNumber} is-${state.toLowerCase()}`}
                  onClick={() => interactPlot(plot)}
                  disabled={Boolean(busy) || !canInteract || (state !== "EMPTY" && cooldownText !== "Livre")}
                  title={
                    state === "EMPTY"
                      ? "Plantar milho"
                      : state === "PLANTED"
                        ? "Plantação crescendo"
                        : "Colher"
                  }
                >
                  <span className="plot-furrows" />
                  <span className="plot-crop-mark">
                    {state === "EMPTY" ? "+" : state === "PLANTED" ? "♧" : state === "READY" ? "♦" : "×"}
                  </span>
                  <span className="plot-bubble">
                    C{plot.slotNumber} · {state === "PLANTED" ? timerText(plot, nowMs) : state === "EMPTY" ? "Plantar" : state === "READY" ? "Colher" : "Apodrecido"}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            className="scene-shortcut fields-shortcut"
            onClick={() => setSection("plantacoes")}
          >
            Ver plantações
          </button>
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
              className="game-action secondary"
              onClick={props.onPlantAll}
              disabled={Boolean(busy)}
            >
              {busy === "plant-all" ? "Plantando..." : "Plantar milho"}
            </button>
            <button
              className="game-action"
              onClick={props.onHarvestAll}
              disabled={Boolean(busy) || cooldownText !== "Livre"}
            >
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
                <div className="game-plot-art">
                  <span>{state === "EMPTY" ? "＋" : state === "PLANTED" ? "♧" : state === "READY" ? "♦" : "×"}</span>
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
                  className="game-action wide"
                  onClick={() => interactPlot(plot)}
                  disabled={
                    Boolean(busy) ||
                    state === "PLANTED" ||
                    ((state === "READY" || state === "ROTTEN") && cooldownText !== "Livre")
                  }
                >
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
            <div className="game-empty-state">
              <strong>Seu celeiro está vazio</strong>
              <span>Colha uma plantação para guardar produtos aqui.</span>
            </div>
          ) : (
            inventory.map((item) => (
              <article key={item.id} className={`game-inventory-card q-${item.quality.toLowerCase()}`}>
                <div className="game-item-art">{item.name.includes("Semente") ? "●" : "♦"}</div>
                <div className="game-item-copy">
                  <strong>{item.name}</strong>
                  <span>{qualityLabel(item.quality)}</span>
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
                    className="game-mini-action"
                    onClick={() => props.onDiscard(item.id)}
                    disabled={Boolean(busy)}
                  >
                    {busy === `discard-${item.id}` ? "Descartando..." : "Descartar 1"}
                  </button>
                </div>
              </article>
            ))
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
              <div className="game-shop-art">●</div>
              <div className="game-item-copy">
                <strong>{offer.itemName}</strong>
                <span>Nível mínimo {offer.minLevel}</span>
              </div>
              <div className="game-shop-buy">
                <strong>{offer.buyPrice} moedas</strong>
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

  function unavailable(title: string, text: string) {
    return (
      <section className="game-page-panel future-panel">
        <div className="future-icon">FQ</div>
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
        return unavailable("Animais", "O espaço já está reservado na nova interface. O sistema de animais será ligado ao backend na fase prevista da arquitetura.");
      case "pedidos":
        return unavailable("Pedidos", "A navegação está pronta. Os pedidos serão ativados quando o módulo correspondente entrar no protótipo.");
      case "exploracao":
        return unavailable("Exploração", "A área visual já existe, mas nenhuma regra de exploração foi adicionada ao 0.1.");
      case "ranking":
        return unavailable("Ranking", "O ranking está previsto para uma fase posterior e ainda não possui endpoint no protótipo.");
      case "conquistas":
        return unavailable("Conquistas", "Esta tela ficará responsável por títulos e conquistas quando esses dados estiverem disponíveis.");
    }
  }

  return (
    <main className="farm-game-shell">
      <header className="farm-game-topbar">
        <div className="farm-game-logo">FarmQuest</div>

        <div className="farm-identity">
          <strong>Fazenda de {userName}</strong>
          <span>Nível {farm.level} · {farm.xp} XP</span>
        </div>

        <div className="farm-resources">
          <div className="resource-chip coin-chip">
            <span className="resource-symbol">●</span>
            <strong>{farm.coins}</strong>
            <small>moedas</small>
          </div>
          <div className="resource-chip">
            <span className="resource-symbol">XP</span>
            <strong>{farm.xp}</strong>
            <small>experiência</small>
          </div>
          <div className="resource-chip">
            <span className="resource-symbol">⌛</span>
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
        <div className="sidebar-brand-mini">FQ</div>
        <nav>
          {menu.map((item) => (
            <button
              key={item.key}
              className={section === item.key || (section === "fazenda" && item.key === "inicio") ? "active" : ""}
              onClick={() => setSection(item.key)}
            >
              <span>{item.icon}</span>
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
        <button onClick={() => setSection("plantacoes")}>
          <span>♧</span>
          <strong>Plantações</strong>
          <small>{plots.length} canteiros</small>
        </button>
        <button onClick={() => setSection("mercado")}>
          <span>▤</span>
          <strong>Mercado</strong>
          <small>Comprar</small>
        </button>
        <button onClick={() => setSection("celeiro")}>
          <span>□</span>
          <strong>Celeiro</strong>
          <small>{inventoryCount} itens</small>
        </button>
        <button onClick={props.onRefresh} disabled={Boolean(busy)}>
          <span>↻</span>
          <strong>Atualizar</strong>
          <small>Sincronizar</small>
        </button>
      </footer>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DEV_CORN_CROP_ID = "00000000-0000-4000-8000-000000000022";

type Farm = {
  id: string;
  level: number;
  xp: string;
  coins: string;
  inventorySlots: number;
  stackLimit: number;
  nextHarvestAt: string | null;
  status: "ACTIVE";
};

type Plot = {
  id: string;
  slotNumber: number;
  unlocked: boolean;
  seedsCapacity: number;
  state: "EMPTY" | "PLANTED" | "READY" | "ROTTEN";
  planted: null | {
    cropDefinitionId: string;
    cropName: string;
    seedCount: number;
    plantedAt: string;
    growsAt: string;
    rotsAt: string;
  };
};

type InventoryItem = {
  id: string;
  itemDefinitionId: string;
  name: string;
  quality:
    | "NONE"
    | "COMMON"
    | "GOOD"
    | "EXCELLENT"
    | "EXTRAORDINARY"
    | "ROTTEN";
  quantity: number;
  reservedQuantity: number;
};

type ShopOffer = {
  id: string;
  itemDefinitionId: string;
  itemName: string;
  buyPrice: string;
  minLevel: number;
  enabled: boolean;
};

type ApiEnvelope<T> = {
  data: T;
  meta: {
    requestId: string;
    serverTime: string;
    linearizedAt?: string;
  };
};

type User = {
  id: string;
  displayName: string;
  role: string;
  authProvider: string;
};

function qualityLabel(quality: InventoryItem["quality"]): string {
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

function effectivePlotState(
  plot: Plot,
  nowMs: number
): Plot["state"] {
  if (!plot.planted) return "EMPTY";

  if (nowMs >= Date.parse(plot.planted.rotsAt)) return "ROTTEN";
  if (nowMs >= Date.parse(plot.planted.growsAt)) return "READY";
  return "PLANTED";
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function plotStateLabel(state: Plot["state"]): string {
  switch (state) {
    case "EMPTY":
      return "Vazio";
    case "PLANTED":
      return "Crescendo";
    case "READY":
      return "Pronto";
    case "ROTTEN":
      return "Apodrecido";
  }
}

function growthProgress(plot: Plot, nowMs: number): number {
  if (!plot.planted) return 0;

  const plantedAt = Date.parse(plot.planted.plantedAt);
  const growsAt = Date.parse(plot.planted.growsAt);
  const duration = growsAt - plantedAt;

  if (duration <= 0) return 100;

  const elapsed = nowMs - plantedAt;
  return Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
}

function friendlyApiMessage(
  code: string,
  details?: Record<string, unknown>
): string {
  const messages: Record<string, string> = {
    FARM_NOT_FOUND: "Fazenda não encontrada.",
    FARM_SOLD: "Esta fazenda não está mais ativa.",
    USER_BANNED: "Esta conta não pode usar a fazenda.",
    FARM_ACCESS_REMOVED: "Você não tem mais acesso a esta comunidade.",
    FARM_STREAMER_SUSPENDED: "Esta comunidade está temporariamente suspensa.",
    UNKNOWN_CROP: "Essa plantação não está disponível.",
    CROP_LOCKED_BY_LEVEL: "Seu nível ainda não libera essa plantação.",
    NOT_ENOUGH_SEEDS: "Você não tem sementes suficientes.",
    NO_EMPTY_PLOTS: "Não há canteiros vazios disponíveis.",
    HARVEST_COOLDOWN_ACTIVE: "A colheita ainda está em tempo de espera.",
    NOTHING_TO_HARVEST: "Ainda não há nada pronto para colher.",
    INVENTORY_FULL: "Seu inventário está cheio.",
    PLOT_ALREADY_HARVESTED: "Esse canteiro já foi colhido.",
    SHOP_OFFER_NOT_FOUND: "Essa oferta não está mais disponível.",
    SHOP_OFFER_LOCKED_BY_LEVEL: "Seu nível ainda não libera essa compra.",
    INSUFFICIENT_COINS: "Você não tem moedas suficientes.",
    INVENTORY_INSUFFICIENT: "Você não tem quantidade suficiente desse item.",
    ITEM_NOT_DISCARDABLE: "Esse item não pode ser descartado.",
    ITEM_ROTTEN: "Itens apodrecidos não podem ser vendidos.",
    ITEM_NOT_SELLABLE: "Esse item não pode ser vendido.",
    IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD:
      "A ação foi repetida com dados diferentes. Atualize a fazenda e tente novamente."
  };

  if (code === "HARVEST_COOLDOWN_ACTIVE") {
    const remaining = details?.remainingSeconds;
    if (typeof remaining === "number") {
      return `Aguarde ${remaining}s para colher novamente.`;
    }
  }

  return messages[code] ?? code;
}

function successMessage(data: Record<string, unknown>): string {
  const code = typeof data.code === "string" ? data.code : "";

  switch (code) {
    case "PLANT_OK": {
      const seeds = typeof data.seedsConsumed === "number" ? data.seedsConsumed : 0;
      const xp = typeof data.xpGranted === "string" ? data.xpGranted : "0";
      return `Plantio concluído: ${seeds} semente${seeds === 1 ? "" : "s"} usada${seeds === 1 ? "" : "s"} · +${xp} XP.`;
    }

    case "HARVEST_OK": {
      const harvested = Array.isArray(data.harvested) ? data.harvested.length : 0;
      const xp =
        typeof data.totalXpGranted === "string" ? data.totalXpGranted : "0";
      return `Colheita concluída: ${harvested} canteiro${harvested === 1 ? "" : "s"} · +${xp} XP.`;
    }

    case "QUICK_SELL_OK": {
      const payout = typeof data.payout === "string" ? data.payout : "0";
      const xp = typeof data.xpGranted === "string" ? data.xpGranted : "0";
      return `Venda concluída: +${payout} moedas · +${xp} XP.`;
    }

    case "SHOP_BUY_OK": {
      const items = typeof data.itemsAdded === "number" ? data.itemsAdded : 0;
      const spent =
        typeof data.coinsSpent === "string" ? data.coinsSpent : "0";
      return `Compra concluída: ${items} item${items === 1 ? "" : "s"} · -${spent} moedas.`;
    }

    case "DISCARD_OK": {
      const quantity =
        typeof data.quantityDiscarded === "number"
          ? data.quantityDiscarded
          : 0;
      return `${quantity} item${quantity === 1 ? "" : "s"} descartado${quantity === 1 ? "" : "s"}.`;
    }

    default:
      return "Ação concluída com sucesso.";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let code = `HTTP_${response.status}`;
  let details: Record<string, unknown> | undefined;

  try {
    const body = await response.json() as {
      error?: {
        code?: string;
        message?: string;
        details?: Record<string, unknown>;
      };
      message?: string;
    };
    code = body.error?.code ?? body.message ?? code;
    details = body.error?.details;
  } catch {
    // Keep the HTTP fallback.
  }

  throw new Error(friendlyApiMessage(code, details));
}

export function FarmQuestClient() {
  const [status, setStatus] = useState<
    "checking" | "signed-out" | "ready" | "error"
  >("checking");
  const [user, setUser] = useState<User | null>(null);
  const [farm, setFarm] = useState<Farm | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shop, setShop] = useState<ShopOffer[]>([]);
  const [csrfToken, setCsrfToken] = useState("");
  const [devSecret, setDevSecret] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadGame = useCallback(async () => {
    const meResponse = await fetch("/api/v1/auth/me", {
      credentials: "include",
      cache: "no-store"
    });

    if (meResponse.status === 401) {
      setStatus("signed-out");
      setUser(null);
      setFarm(null);
      return;
    }

    const me = await readJson<User>(meResponse);
    const farms = await readJson<Farm[]>(
      await fetch("/api/v1/farms", {
        credentials: "include",
        cache: "no-store"
      })
    );

    const activeFarm = farms[0];
    if (!activeFarm) {
      throw new Error("Nenhuma fazenda ativa encontrada.");
    }

    const [plotPayload, inventoryPayload, shopPayload, csrfPayload] =
      await Promise.all([
        readJson<{ serverTime: string; plots: Plot[] }>(
          await fetch(`/api/v1/farms/${activeFarm.id}/plots`, {
            credentials: "include",
            cache: "no-store"
          })
        ),
        readJson<ApiEnvelope<InventoryItem[]>>(
          await fetch(`/api/v1/farms/${activeFarm.id}/inventory`, {
            credentials: "include",
            cache: "no-store"
          })
        ),
        readJson<ApiEnvelope<ShopOffer[]>>(
          await fetch(
            `/api/v1/shop?farmId=${encodeURIComponent(activeFarm.id)}`,
            {
              credentials: "include",
              cache: "no-store"
            }
          )
        ),
        readJson<{ csrfToken: string }>(
          await fetch("/api/v1/auth/csrf", {
            credentials: "include",
            cache: "no-store"
          })
        )
      ]);

    setUser(me);
    setFarm(activeFarm);
    setPlots(plotPayload.plots);
    setInventory(inventoryPayload.data);
    setShop(shopPayload.data);
    setCsrfToken(csrfPayload.csrfToken);
    setStatus("ready");
    setError("");
  }, []);

  useEffect(() => {
    loadGame().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar.");
      setStatus("error");
    });
  }, [loadGame]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function login() {
    setBusy("login");
    setError("");

    try {
      const response = await fetch("/api/v1/dev/session", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-Dev-Login-Secret": devSecret,
          "Content-Type": "application/json"
        },
        body: "{}"
      });

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Senha do protótipo incorreta."
            : "Login de desenvolvimento indisponível."
        );
      }

      setDevSecret("");
      await loadGame();
      setNotice("Fazenda carregada.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível entrar."
      );
    } finally {
      setBusy("");
    }
  }

  async function mutate(
    action: string,
    path: string,
    body?: Record<string, unknown>
  ) {
    if (!csrfToken) return;

    setBusy(action);
    setError("");
    setNotice("");

    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrfToken,
          "Idempotency-Key": crypto.randomUUID(),
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

      const payload = await readJson<ApiEnvelope<Record<string, unknown>>>(
        response
      );

      setNotice(successMessage(payload.data));
      await loadGame();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "A ação não pôde ser concluída."
      );
    } finally {
      setBusy("");
    }
  }

  async function logout() {
    if (!csrfToken) return;

    setBusy("logout");
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrfToken
        }
      });

      if (!response.ok) throw new Error("Falha ao sair.");

      setStatus("signed-out");
      setUser(null);
      setFarm(null);
      setPlots([]);
      setInventory([]);
      setShop([]);
      setCsrfToken("");
      setNotice("");
      setError("");
    } finally {
      setBusy("");
    }
  }

  const cooldownText = useMemo(() => {
    if (!farm?.nextHarvestAt) return "Livre";
    const remaining = Date.parse(farm.nextHarvestAt) - nowMs;
    return remaining <= 0 ? "Livre" : formatDuration(remaining);
  }, [farm?.nextHarvestAt, nowMs]);

  if (status === "checking") {
    return (
      <main className="center-shell">
        <section className="login-card">
          <div className="logo-mark">FQ</div>
          <h1>FarmQuest</h1>
          <p>Carregando o Protótipo 0.1...</p>
        </section>
      </main>
    );
  }

  if (status === "signed-out") {
    return (
      <main className="center-shell">
        <section className="login-card">
          <div className="logo-mark">FQ</div>
          <span className="eyebrow">PROTÓTIPO 0.1</span>
          <h1>FarmQuest</h1>
          <p>
            Entre no ambiente de desenvolvimento para testar o primeiro ciclo
            real da fazenda.
          </p>

          <label className="field-label" htmlFor="dev-secret">
            Senha do protótipo
          </label>
          <input
            id="dev-secret"
            className="text-input"
            type="password"
            value={devSecret}
            onChange={(event) => setDevSecret(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && devSecret) void login();
            }}
            placeholder="Digite a senha DEV"
            autoComplete="current-password"
          />

          <button
            className="primary-button wide"
            onClick={() => void login()}
            disabled={!devSecret || busy === "login"}
          >
            {busy === "login" ? "Entrando..." : "Entrar na fazenda"}
          </button>

          {error ? <p className="error-banner">{error}</p> : null}
          <small>
            A senha não é salva no navegador. Twitch será conectado na fase
            seguinte.
          </small>
        </section>
      </main>
    );
  }

  if (status === "error" || !farm || !user) {
    return (
      <main className="center-shell">
        <section className="login-card">
          <h1>FarmQuest</h1>
          <p className="error-banner">{error || "Falha ao carregar a fazenda."}</p>
          <button className="primary-button" onClick={() => void loadGame()}>
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="farm-brand">
          <div className="farm-brand-mark" aria-hidden="true">FQ</div>
          <div>
            <span className="eyebrow">FARMQUEST · PROTÓTIPO 0.1</span>
            <h1>Fazenda de {user.displayName}</h1>
            <span className="farm-subtitle">Sua fazenda local está ativa e conectada ao PostgreSQL.</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="ghost-button"
            onClick={() => void loadGame()}
            disabled={Boolean(busy)}
          >
            Atualizar
          </button>
          <button
            className="ghost-button"
            onClick={() => void logout()}
            disabled={Boolean(busy)}
          >
            Sair
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <article className="stat-card level-card">
          <div className="stat-icon" aria-hidden="true">⭐</div>
          <div>
            <span>Nível</span>
            <strong>{farm.level}</strong>
            <small>Progressão da fazenda</small>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon" aria-hidden="true">🌾</div>
          <div>
            <span>XP</span>
            <strong>{farm.xp}</strong>
            <small>Experiência acumulada</small>
          </div>
        </article>
        <article className="stat-card coins">
          <div className="stat-icon" aria-hidden="true">🪙</div>
          <div>
            <span>Moedas</span>
            <strong>{farm.coins}</strong>
            <small>Saldo disponível</small>
          </div>
        </article>
        <article className="stat-card harvest-card">
          <div className="stat-icon" aria-hidden="true">⏱️</div>
          <div>
            <span>Colheita</span>
            <strong>{cooldownText}</strong>
            <small>{cooldownText === "Livre" ? "Pode colher agora" : "Tempo restante"}</small>
          </div>
        </article>
      </section>

      {notice ? (
        <div className="notice-banner" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="error-banner page-error" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}

      <section className="farm-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TERRENO</span>
            <h2>Seus canteiros</h2>
            <p className="section-copy">Plante, acompanhe o crescimento e colha quando estiver pronto.</p>
          </div>
          <div className="heading-actions">
            <button
              className="secondary-button"
              disabled={Boolean(busy)}
              onClick={() =>
                void mutate("plant-all", `/api/v1/farms/${farm.id}/plant`, {
                  cropDefinitionId: DEV_CORN_CROP_ID
                })
              }
            >
              {busy === "plant-all" ? "Plantando..." : "🌱 Plantar milho"}
            </button>
            <button
              className="primary-button"
              disabled={Boolean(busy) || cooldownText !== "Livre"}
              onClick={() =>
                void mutate(
                  "harvest-all",
                  `/api/v1/farms/${farm.id}/harvest`
                )
              }
            >
              {busy === "harvest-all" ? "Colhendo..." : "🧺 Colher tudo"}
            </button>
          </div>
        </div>

        <div className="plots-grid">
          {plots.map((plot) => {
            const state = effectivePlotState(plot, nowMs);
            const remaining = plot.planted
              ? Date.parse(plot.planted.growsAt) - nowMs
              : 0;
            const progress = growthProgress(plot, nowMs);

            return (
              <article
                key={plot.id}
                className={`plot-card plot-${state.toLowerCase()}`}
              >
                <div className="plot-ground">
                  <span className="plot-number">Canteiro {plot.slotNumber}</span>
                  <span className={`plot-state state-${state.toLowerCase()}`}>
                    {plotStateLabel(state)}
                  </span>
                  <span
                    className={`crop-visual crop-${state.toLowerCase()}`}
                    aria-hidden="true"
                  >
                    {state === "EMPTY" ? (
                      <span className="soil-tile" />
                    ) : state === "PLANTED" ? (
                      <span className="sprout-visual">
                        <span className="sprout-stem" />
                        <span className="sprout-leaf leaf-left" />
                        <span className="sprout-leaf leaf-right" />
                      </span>
                    ) : state === "READY" ? (
                      <span className="corn-visual">
                        <span className="corn-cob" />
                        <span className="corn-leaf corn-leaf-left" />
                        <span className="corn-leaf corn-leaf-right" />
                      </span>
                    ) : (
                      <span className="wilted-visual">
                        <span className="wilted-stem" />
                        <span className="wilted-head" />
                      </span>
                    )}
                  </span>

                  <strong>
                    {state === "EMPTY"
                      ? "Vazio"
                      : plot.planted?.cropName ?? "Cultivo"}
                  </strong>

                  <span className="plot-status">
                    {state === "PLANTED"
                      ? `Pronto em ${formatDuration(remaining)}`
                      : state === "READY"
                        ? "Pronto para colher"
                        : state === "ROTTEN"
                          ? "Apodrecido — ainda pode colher"
                          : "Disponível para plantio"}
                  </span>

                  <div className="plot-meta">
                    <span>
                      {plot.planted
                        ? `${plot.planted.seedCount} semente${plot.planted.seedCount === 1 ? "" : "s"}`
                        : `Capacidade: ${plot.seedsCapacity}`}
                    </span>
                    {state === "PLANTED" ? <span>{progress}%</span> : null}
                  </div>

                  {state === "PLANTED" ? (
                    <div
                      className="growth-track"
                      aria-label={`Crescimento ${progress}%`}
                    >
                      <div
                        className="growth-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>

                {state === "EMPTY" ? (
                  <button
                    className="plot-button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void mutate(
                        `plant-${plot.id}`,
                        `/api/v1/farms/${farm.id}/plots/${plot.id}/plant`,
                        { cropDefinitionId: DEV_CORN_CROP_ID }
                      )
                    }
                  >
                    {busy === `plant-${plot.id}` ? "Plantando..." : "Plantar"}
                  </button>
                ) : state === "READY" || state === "ROTTEN" ? (
                  <button
                    className="plot-button"
                    disabled={Boolean(busy) || cooldownText !== "Livre"}
                    onClick={() =>
                      void mutate(
                        `harvest-${plot.id}`,
                        `/api/v1/farms/${farm.id}/plots/${plot.id}/harvest`
                      )
                    }
                  >
                    {busy === `harvest-${plot.id}` ? "Colhendo..." : "Colher"}
                  </button>
                ) : (
                  <div className="plot-button disabled">Crescendo...</div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div className="lower-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">CELEIRO</span>
              <h2>Inventário</h2>
            </div>
            <span className="capacity">
              <strong>{inventory.length}</strong> linhas · <strong>{farm.inventorySlots}</strong> slots
            </span>
          </div>

          <div className="inventory-list">
            {inventory.length === 0 ? (
              <div className="empty-state">
                <span className="empty-barn-icon" aria-hidden="true">
                  <span className="barn-roof" />
                  <span className="barn-body">
                    <span className="barn-door" />
                  </span>
                </span>
                <strong>Seu celeiro está vazio</strong>
                <span>Colha sua produção para ver os itens aqui.</span>
              </div>
            ) : (
              inventory.map((item) => (
                <article
                  key={item.id}
                  className={`inventory-row inventory-${item.quality.toLowerCase()}`}
                >
                  <div className="item-icon">
                    {item.name.includes("Semente") ? "🌰" : "🌽"}
                  </div>
                  <div className="item-main">
                    <strong>{item.name}</strong>
                    <span className={`quality q-${item.quality.toLowerCase()}`}>
                      <span className="quality-dot" aria-hidden="true" />
                      {qualityLabel(item.quality)}
                    </span>
                  </div>
                  <strong className="item-qty">x{item.quantity}</strong>
                  <div className="item-actions">
                    {item.quality !== "NONE" && item.quality !== "ROTTEN" ? (
                      <button
                        className="mini-button sell"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void mutate(
                            `sell-${item.id}`,
                            `/api/v1/farms/${farm.id}/market/quick-sell`,
                            {
                              inventoryItemId: item.id,
                              quantity: 1
                            }
                          )
                        }
                      >
                        {busy === `sell-${item.id}` ? "Vendendo..." : "Vender 1"}
                      </button>
                    ) : null}
                    <button
                      className="mini-button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void mutate(
                          `discard-${item.id}`,
                          `/api/v1/farms/${farm.id}/inventory/${item.id}/discard`,
                          { quantity: 1 }
                        )
                      }
                    >
                      {busy === `discard-${item.id}`
                        ? "Descartando..."
                        : "Descartar 1"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel shop-panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">LOJA NPC · PROVISÓRIO</span>
              <h2>Mercado rural</h2>
              <p className="section-copy">Compre suprimentos para manter a produção girando.</p>
            </div>
          </div>

          <div className="shop-list">
            {shop.map((offer) => (
              <article key={offer.id} className="shop-row">
                <div className="shop-icon">🌰</div>
                <div>
                  <strong>{offer.itemName}</strong>
                  <span>Nível mínimo {offer.minLevel}</span>
                </div>
                <div className="shop-price">
                  <strong>🪙 {offer.buyPrice}</strong>
                  <button
                    className="mini-button buy"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void mutate(
                        `buy-${offer.id}`,
                        `/api/v1/farms/${farm.id}/shop/buy`,
                        { offerId: offer.id, quantity: 1 }
                      )
                    }
                  >
                    {busy === `buy-${offer.id}` ? "Comprando..." : "Comprar 1"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer className="prototype-footer">
        Dados persistidos no PostgreSQL · Backend autoritativo · Twitch ainda
        desligado no 0.1
      </footer>
    </main>
  );
}

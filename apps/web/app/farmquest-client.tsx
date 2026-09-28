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

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let code = `HTTP_${response.status}`;
  try {
    const body = await response.json() as {
      error?: { code?: string; message?: string };
      message?: string;
    };
    code = body.error?.code ?? body.message ?? code;
  } catch {
    // Keep the HTTP fallback.
  }

  throw new Error(code);
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

      const code =
        typeof payload.data.code === "string"
          ? payload.data.code
          : "Ação concluída.";

      setNotice(code);
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
        <div>
          <span className="eyebrow">FARMQUEST · PROTÓTIPO 0.1</span>
          <h1>Fazenda de {user.displayName}</h1>
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
        <article className="stat-card">
          <span>Nível</span>
          <strong>{farm.level}</strong>
        </article>
        <article className="stat-card">
          <span>XP</span>
          <strong>{farm.xp}</strong>
        </article>
        <article className="stat-card coins">
          <span>Moedas</span>
          <strong>🪙 {farm.coins}</strong>
        </article>
        <article className="stat-card">
          <span>Colheita</span>
          <strong>{cooldownText}</strong>
        </article>
      </section>

      {notice ? <div className="notice-banner">{notice}</div> : null}
      {error ? <div className="error-banner page-error">{error}</div> : null}

      <section className="farm-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TERRENO</span>
            <h2>Seus canteiros</h2>
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
              🌱 Plantar milho
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
              🧺 Colher tudo
            </button>
          </div>
        </div>

        <div className="plots-grid">
          {plots.map((plot) => {
            const state = effectivePlotState(plot, nowMs);
            const remaining = plot.planted
              ? Date.parse(plot.planted.growsAt) - nowMs
              : 0;

            return (
              <article
                key={plot.id}
                className={`plot-card plot-${state.toLowerCase()}`}
              >
                <div className="plot-ground">
                  <span className="plot-number">Canteiro {plot.slotNumber}</span>
                  <span className="crop-icon">
                    {state === "EMPTY"
                      ? "🟫"
                      : state === "PLANTED"
                        ? "🌱"
                        : state === "READY"
                          ? "🌽"
                          : "🥀"}
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
                    Plantar
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
                    Colher
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
              {inventory.length} linhas · {farm.inventorySlots} slots
            </span>
          </div>

          <div className="inventory-list">
            {inventory.length === 0 ? (
              <p className="empty-state">Seu inventário está vazio.</p>
            ) : (
              inventory.map((item) => (
                <article key={item.id} className="inventory-row">
                  <div className="item-icon">
                    {item.name.includes("Semente") ? "🌰" : "🌽"}
                  </div>
                  <div className="item-main">
                    <strong>{item.name}</strong>
                    <span className={`quality q-${item.quality.toLowerCase()}`}>
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
                        Vender 1
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
                      Descartar 1
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
                    Comprar 1
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

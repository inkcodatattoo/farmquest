"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FarmWorld } from "./farm-world";
import type {
  FarmWorldFarm,
  FarmWorldInventoryItem,
  FarmWorldPlot,
  FarmWorldShopOffer
} from "./farm-world-model";

const DEV_CORN_CROP_ID = "00000000-0000-4000-8000-000000000022";

type Farm = FarmWorldFarm & {
  stackLimit: number;
  nextHarvestAt: string | null;
  status: "ACTIVE";
};

type Plot = FarmWorldPlot;

type InventoryItem = FarmWorldInventoryItem & {
  itemDefinitionId: string;
  reservedQuantity: number;
};

type ShopOffer = FarmWorldShopOffer & {
  itemDefinitionId: string;
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

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
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

  const harvestCooldown = useMemo(() => {
    if (!farm?.nextHarvestAt) {
      return { text: "Livre", available: true };
    }

    const remaining = Date.parse(farm.nextHarvestAt) - nowMs;
    return remaining <= 0
      ? { text: "Livre", available: true }
      : { text: formatDuration(remaining), available: false };
  }, [farm?.nextHarvestAt, nowMs]);

  if (status === "checking") {
    return (
      <main className="center-shell">
        <section className="login-card">
          <img
            className="login-brand-logo"
            src="/game-assets/brand/farmquest-logo.png"
            alt=""
            draggable={false}
          />
          <h1 className="login-brand-heading">FarmQuest</h1>
          <p>Carregando o Protótipo 0.1...</p>
        </section>
      </main>
    );
  }

  if (status === "signed-out") {
    return (
      <main className="center-shell">
        <section className="login-card">
          <img
            className="login-brand-logo"
            src="/game-assets/brand/farmquest-logo.png"
            alt=""
            draggable={false}
          />
          <h1 className="login-brand-heading">FarmQuest</h1>
          <span className="eyebrow">PROTÓTIPO 0.1</span>
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
          <img
            className="login-brand-logo"
            src="/game-assets/brand/farmquest-logo.png"
            alt=""
            draggable={false}
          />
          <h1 className="login-brand-heading">FarmQuest</h1>
          <p className="error-banner">{error || "Falha ao carregar a fazenda."}</p>
          <button className="primary-button" onClick={() => void loadGame()}>
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  return (
    <FarmWorld
      userName={user.displayName}
      farm={farm}
      plots={plots}
      inventory={inventory}
      shop={shop}
      cooldownText={harvestCooldown.text}
      canHarvest={harvestCooldown.available}
      nowMs={nowMs}
      busy={busy}
      notice={notice}
      error={error}
      onRefresh={() => void loadGame()}
      onLogout={() => void logout()}
      onPlantAll={() =>
        void mutate("plant-all", `/api/v1/farms/${farm.id}/plant`, {
          cropDefinitionId: DEV_CORN_CROP_ID
        })
      }
      onHarvestAll={() =>
        void mutate("harvest-all", `/api/v1/farms/${farm.id}/harvest`)
      }
      onPlantPlot={(plotId) =>
        void mutate(
          `plant-${plotId}`,
          `/api/v1/farms/${farm.id}/plots/${plotId}/plant`,
          { cropDefinitionId: DEV_CORN_CROP_ID }
        )
      }
      onHarvestPlot={(plotId) =>
        void mutate(
          `harvest-${plotId}`,
          `/api/v1/farms/${farm.id}/plots/${plotId}/harvest`
        )
      }
      onSell={(itemId) =>
        void mutate(
          `sell-${itemId}`,
          `/api/v1/farms/${farm.id}/market/quick-sell`,
          { inventoryItemId: itemId, quantity: 1 }
        )
      }
      onDiscard={(itemId) =>
        void mutate(
          `discard-${itemId}`,
          `/api/v1/farms/${farm.id}/inventory/${itemId}/discard`,
          { quantity: 1 }
        )
      }
      onBuy={(offerId) =>
        void mutate(
          `buy-${offerId}`,
          `/api/v1/farms/${farm.id}/shop/buy`,
          { offerId, quantity: 1 }
        )
      }
    />
  );
}

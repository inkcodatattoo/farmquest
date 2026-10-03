"use client";

import { useMemo, useState } from "react";
import { FarmPanels } from "./farm-panels";
import { PixelIcon } from "./farm-plot";
import { FarmScene } from "./farm-scene";
import { FARM_ICONS } from "./farm-icons";
import {
  FARM_WORLD_NAVIGATION,
  type FarmWorldProps,
  type Section
} from "./farm-world-model";

export type {
  FarmWorldFarm,
  FarmWorldInventoryItem,
  FarmWorldPlot,
  FarmWorldShopOffer
} from "./farm-world-model";
const FARM_PANEL_NAVIGATION: readonly Section[] = [
  "inicio",
  "celeiro",
  "animais",
  "pedidos",
  "comunidade",
  "exploracao",
  "ranking",
  "conquistas"
];

export function FarmWorld(props: FarmWorldProps) {
  const [section, setSection] = useState<Section>("inicio");
  const inventoryCount = useMemo(
    () => props.inventory.reduce((sum, item) => sum + item.quantity, 0),
    [props.inventory]
  );
  return (
    
    <main
  className={`farm-game-shell pixel-ui-shell ${
    section === "inicio" ? "is-home" : ""
  }`}
>
      <header
  className="farm-game-topbar"

>
        <div className="farm-game-logo pixel-logo">
          <img
            className="farm-game-brand-logo"
            src="/game-assets/brand/farmquest-logo.png"
            alt="FarmQuest"
            draggable={false}
          />
        </div>

        <div className="farm-identity">
          <strong>Fazenda de {props.userName}</strong>
          <span>Nível {props.farm.level} · {props.farm.xp} XP</span>
        </div>

        <div className="farm-resources">
          <div className="resource-chip coin-chip">
            <span className="resource-symbol pixel-resource-symbol">
              <PixelIcon src={FARM_ICONS.ui.coins} alt="Moedas" />
            </span>
            <strong>{props.farm.coins}</strong>
            <small>moedas</small>
          </div>
          <div className="resource-chip">
            <span className="resource-symbol pixel-resource-symbol">
              <PixelIcon src={FARM_ICONS.ui.xp} alt="Experiência" />
            </span>
            <strong>{props.farm.xp}</strong>
            <small>experiência</small>
          </div>
          <div className="resource-chip">
            <span className="resource-symbol pixel-resource-symbol">
              <PixelIcon src={FARM_ICONS.actions.harvest} alt="Colheita" />
            </span>
            <strong>{props.cooldownText}</strong>
            <small>colheita</small>
          </div>
        </div>

        <div className="farm-system-actions">
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={Boolean(props.busy)}
            title="Atualizar"
            aria-label="Atualizar fazenda"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={props.onLogout}
            disabled={Boolean(props.busy)}
            title="Sair"
            aria-label="Sair"
          >
            ×
          </button>
        </div>
      </header>

      <aside className="farm-game-sidebar farm-game-sidebar--panel">
  <nav className="farm-menu-panel" aria-label="Navegação principal">
    <img
      className="farm-menu-panel__art"
      src="/game-assets/panels/painel_menu_home.png"
      alt=""
      draggable={false}
    />

    {FARM_PANEL_NAVIGATION.map((key) => {
      const item = FARM_WORLD_NAVIGATION.find(
        (candidate) => candidate.key === key
      );

      if (!item) return null;

      return (
        <button
          key={key}
          type="button"
          className={`farm-menu-panel__hotspot farm-menu-panel__hotspot--${key} ${
            section === key ? "is-active" : ""
          }`}
          onClick={() => setSection(key)}
          aria-label={item.label}
          aria-current={section === key ? "page" : undefined}
          title={item.label}
        />
      );
    })}
  </nav>
</aside>

      <section className="farm-game-stage">
  {props.notice ? (
  <div
    className="farm-notice-popup farm-notice-popup--success"
    role="status"
    aria-live="polite"
  >
    <img
      className="farm-notice-popup__panel"
      src="/game-assets/panels/painel_notificacao.png"
      alt=""
      draggable={false}
    />

    <span className="farm-notice-popup__text">
      {props.notice}
    </span>
  </div>
) : null}

{props.error ? (
  <div
    className="farm-notice-popup farm-notice-popup--error"
    role="alert"
  >
    <img
      className="farm-notice-popup__panel"
      src="/game-assets/panels/painel_notificacao.png"
      alt=""
      draggable={false}
    />

    <span className="farm-notice-popup__text">
      {props.error}
    </span>
  </div>
) : null}

  {section === "inicio" ? (
    <FarmScene
      {...props}
      activeSection={section}
      onSectionChange={setSection}
    />
  ) : (
    <FarmPanels
      {...props}
      section={section}
      onSectionChange={setSection}
    />
  )}
</section>

      <footer
  className="farm-game-dock"

>
        {FARM_WORLD_NAVIGATION.filter((item) => item.dock).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
          >
            <span className="pixel-dock-icon">
              <PixelIcon src={item.icon} alt="" />
            </span>
            <strong>{item.dockLabel ?? item.label}</strong>
            <small>
              {item.key === "celeiro" ? `${inventoryCount} itens` : item.dockHint}
            </small>
          </button>
        ))}
      </footer>
    </main>
  );
}

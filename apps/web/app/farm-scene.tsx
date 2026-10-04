"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FARM_ICONS } from "./farm-icons";
import { FarmPlot, PixelIcon, type FarmPlotPlacement } from "./farm-plot";
import {
  FARM_WORLD_NAVIGATION,
  MAX_FARM_PLOTS,
  buildFarmPlotSlots,
  resolvePlotState,
  type FarmWorldProps,
  type Section
} from "./farm-world-model";
const COW_CHEW_FRAMES = [
  "/game-assets/animals/vaca_mastigando/vaca_mastiga_01.png",
  "/game-assets/animals/vaca_mastigando/vaca_mastiga_02.png",
  "/game-assets/animals/vaca_mastigando/vaca_mastiga_03.png",
  "/game-assets/animals/vaca_mastigando/vaca_mastiga_04.png",
  "/game-assets/animals/vaca_mastigando/vaca_mastiga_05.png",
  "/game-assets/animals/vaca_mastigando/vaca_mastiga_06.png"
] as const;

/*
  Vai e volta para não pular do último frame
  diretamente para o primeiro.
*/
const COW_CHEW_SEQUENCE = [
  1,3,1,4,3,1,4,3,1,4,3,1,4,3,1,4,3,1,4 
] as const;

type ScenePlacement = {
  left: string;
  top: string;
  width: string;
  height: string;
};

const NAVIGATION_TOP: Partial<Record<Section, string>> = {
  inicio: "13.4%",
  plantacoes: "19.4%",
  animais: "25.4%",
  celeiro: "31.5%",
  mercado: "37.4%",
  comunidade: "43.5%",
  ranking: "49.5%"
};

export const FARM_SCENE_PLOT_LAYOUT: readonly FarmPlotPlacement[] = [
  // LINHA SUPERIOR
  { left: "9.9%",  top: "49.9%", width: "6.7%", height: "7.0%" },
  { left: "17.2%", top: "49.9%", width: "6.7%", height: "7.0%" },
  { left: "24.6%", top: "49.9%", width: "6.7%", height: "7.0%" },
  { left: "31.9%", top: "49.9%", width: "6.7%", height: "7.0%" },
  { left: "39.2%", top: "49.9%", width: "6.7%", height: "7.0%" },

  // LINHA INFERIOR
  { left: "8.1%",  top: "58.3%", width: "7.2%", height: "7.1%" },
  { left: "16.0%", top: "58.3%", width: "7.2%", height: "7.1%" },
  { left: "23.8%", top: "58.3%", width: "7.2%", height: "7.1%" },
  { left: "31.5%", top: "58.3%", width: "7.2%", height: "7.1%" },
  { left: "39.2%", top: "58.3%", width: "7.2%", height: "7.1%" },
] as const;

if (FARM_SCENE_PLOT_LAYOUT.length !== MAX_FARM_PLOTS) {
  throw new Error("O layout visual da fazenda deve possuir exatamente 10 canteiros.");
}

function placementStyle(placement: ScenePlacement): CSSProperties {
  return {
    "--hotspot-left": placement.left,
    "--hotspot-top": placement.top,
    "--hotspot-width": placement.width,
    "--hotspot-height": placement.height
  } as CSSProperties;
}

type FarmBuildingProps = {
  label: string;
  placement: ScenePlacement;
  onOpen: () => void;
};

export function FarmBuilding({ label, placement, onOpen }: FarmBuildingProps) {
  return (
    <button
      className="farm-scene__hotspot farm-scene__building"
      style={placementStyle(placement)}
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
    />
  );
}

type FarmAnimalsAreaProps = FarmBuildingProps;

export function FarmAnimalsArea(props: FarmAnimalsAreaProps) {
  return (
    <button
      className="farm-scene__hotspot farm-scene__animals-area"
      style={placementStyle(props.placement)}
      type="button"
      onClick={props.onOpen}
      aria-label={props.label}
      title={props.label}
    />
  );
}

type HUDProps = Pick<
  FarmWorldProps,
  "userName" | "farm" | "plots" | "inventory" | "nowMs"
>;

function xpGoalForLevel(level: number): number {
  if (level <= 1) return 100;
  if (level === 2) return 200;
  return Math.max(300, level * 100);
}

export function HUD({ userName, farm, plots, inventory, nowMs }: HUDProps) {
  const unlockedPlots = plots.filter((plot) => plot.unlocked);
  const readyCount = unlockedPlots.filter(
    (plot) => resolvePlotState(plot, nowMs) === "READY"
  ).length;
  const seedCount = inventory
    .filter((item) => item.name.toLowerCase().includes("semente"))
    .reduce((sum, item) => sum + item.quantity, 0);
  const xpValue = Number(farm.xp) || 0;
  const xpGoal = xpGoalForLevel(farm.level);
  const xpProgress = Math.max(0, Math.min(100, (xpValue / xpGoal) * 100));

  return (
    <div className="farm-scene__hud">
      <div className="farm-scene__coins" aria-label={`${farm.coins} moedas`}>
        <PixelIcon src={FARM_ICONS.ui.coins} alt="" />
        <strong>{farm.coins}</strong>
      </div>

      <div
        className="farm-scene__xp"
        aria-label={`${xpValue} de ${xpGoal} de experiÃªncia`}
      >
        <PixelIcon src={FARM_ICONS.ui.xp} alt="" />
        <span className="farm-scene__xp-track">
          <i style={{ width: `${xpProgress}%` }} />
        </span>
        <strong>{xpValue}/{xpGoal}</strong>
      </div>

      <div className="farm-scene__farm-name">
        <strong>Fazenda do {userName}</strong>
      </div>

      <div className="farm-scene__level" aria-label={`NÃ­vel ${farm.level}`}>
        <strong>{farm.level}</strong>
      </div>

      <div
        className="farm-scene__tasks"
        aria-label={`${unlockedPlots.length} canteiros, ${seedCount} sementes, ${readyCount} ${readyCount === 1 ? "colheita pronta" : "colheitas prontas"}`}
      >
        <span>
          <PixelIcon src={FARM_ICONS.plots.empty} alt="" />
          <strong>{unlockedPlots.length}</strong>
          <em>canteiros</em>
        </span>
        <span>
          <PixelIcon src={FARM_ICONS.seeds.milho} alt="" />
          <strong>{seedCount}</strong>
          <em>sementes</em>
        </span>
        <span>
          <PixelIcon src={FARM_ICONS.actions.harvest} alt="" />
          <strong>{readyCount}</strong>
          <em>{readyCount === 1 ? "colheita pronta" : "colheitas prontas"}</em>
        </span>
      </div>
    </div>
  );
}

type FarmSceneProps = FarmWorldProps & {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
};

export function FarmScene({
  activeSection,
  onSectionChange,
  ...props
}: FarmSceneProps) {
  const slots = buildFarmPlotSlots(props.plots, props.nowMs);
  const [cowChewStep, setCowChewStep] = useState(0);

useEffect(() => {
  const timer = window.setInterval(() => {
    setCowChewStep((current) =>
      (current + 1) % COW_CHEW_SEQUENCE.length
    );
  }, 600);

  return () => window.clearInterval(timer);
}, []);

const cowFrame =
  COW_CHEW_FRAMES[COW_CHEW_SEQUENCE[cowChewStep] ?? 0];
  const homeNavigation = FARM_WORLD_NAVIGATION.filter((item) => item.home);

  function interactPlot(plotId: string) {
    const plot = props.plots.find((candidate) => candidate.id === plotId);
    if (!plot) return;

    const state = resolvePlotState(plot, props.nowMs);
    if (state === "AVAILABLE") props.onPlantPlot(plot.id);
    if (state === "READY" || state === "ROTTEN") {
      props.onHarvestPlot(plot.id);
    }
  }

  return (
    <main className="farm-scene-shell">
      <section className="farm-scene" aria-label="Fazenda principal">
        <div className="farm-scene__map">
          <img
            className="farm-scene__art"
            src="/game-assets/home/farmquest-home-v4.webp"
            alt="Fazenda principal FarmQuest"
            draggable={false}
          /><button
  type="button"
  className="farm-scene__building farm-scene__building--house"
  onClick={() => onSectionChange("inicio")}
  aria-label="Casa da fazenda"
  title="Casa da fazenda"
>
  <img
  src={FARM_ICONS.buildings.farmhouse}
  alt=""
  className="farm-scene__building-art"
  draggable={false}
/>
</button>
<button
  type="button"
  className="farm-scene__building farm-scene__building--barn"
  onClick={() => onSectionChange("celeiro")}
  aria-label="Celeiro"
  title="Abrir celeiro"
>
  <img
    src={FARM_ICONS.buildings.barn}
    alt=""
    className="farm-scene__building-art"
    draggable={false}
  />
</button>

<button
  type="button"
  className="farm-scene__building farm-scene__building--barn"
  onClick={() => onSectionChange("celeiro")}
  aria-label="Celeiro"
  title="Abrir celeiro"
>
  
</button>

          <div className="farm-scene__sky" aria-hidden="true" />

          <div className="farm-scene__shadows" aria-hidden="true">
  <span className="farm-scene__shadow farm-scene__shadow--house" />
  <span className="farm-scene__shadow farm-scene__shadow--barn" />

  
  <span
  style={{
    position: "absolute",
    left: "76%",
    top: "40.5%",
    width: "6.5%",
    height: "12%",
    display: "block",
    zIndex: 25,
    pointerEvents: "none"
  }}
>
  <img
    src={cowFrame}
    alt=""
    draggable={false}
    style={{
      width: "100%",
      height: "100%",
      objectFit: "contain",
      objectPosition: "center bottom",
      display: "block",
      imageRendering: "pixelated"
    }}
  />
</span>
<span
  style={{
    position: "absolute",
    left: "76%",
    top: "40.5%",
    width: "6.5%",
    height: "12%",
    display: "block",
    zIndex: 25,
    pointerEvents: "none"
  }}
>
  <img
    src={cowFrame}
    alt=""
    draggable={false}
    style={{
      width: "100%",
      height: "100%",
      objectFit: "contain",
      objectPosition: "center bottom",
      display: "block",
      imageRendering: "pixelated"
    }}
  />
</span>

{/* FENO DO CURRAL */}
<img
  src="/game-assets/props/curral/feno_curral.png"
  alt=""
  draggable={false}
  style={{
    position: "absolute",
    left: "72.9%",
    top: "46.5%",
    width: "6.2%",
    height: "auto",
    display: "block",
    zIndex: 24,
    pointerEvents: "none",
    userSelect: "none",
    objectFit: "contain",
    imageRendering: "pixelated"
  }}
/>

</div>
            
          
          <img
  className="farm-scene__cow-animated"
  src="/game-assets/animals/vaca_mastigando/vaca_mastiga_01.png"
  alt=""
  draggable={false}
/>

          <nav className="farm-scene__nav" aria-label="NavegaÃ§Ã£o da Home">
            {homeNavigation.map((item) => {
              const top = NAVIGATION_TOP[item.key];
              if (!top) return null;

              return (
                <button
                  key={item.key}
                  className={`farm-scene__hotspot farm-scene__nav-button ${activeSection === item.key ? "is-active" : ""}`}
                  style={placementStyle({
                    left: "1.9%",
                    top,
                    width: "8.4%",
                    height: "4.2%"
                  })}
                  type="button"
                  onClick={() => onSectionChange(item.key)}
                  aria-label={item.label}
                  aria-current={activeSection === item.key ? "page" : undefined}
                  title={item.label}
                />
              );
            })}
          </nav>

          <FarmBuilding
            label="Casa da fazenda"
            placement={{ left: "20.5%", top: "10.4%", width: "17.5%", height: "27.5%" }}
            onOpen={() => onSectionChange("plantacoes")}
          />
          <FarmBuilding
            label="Abrir celeiro"
            placement={{ left: "66.5%", top: "10.8%", width: "18.6%", height: "26.5%" }}
            onOpen={() => onSectionChange("celeiro")}
          />
          <FarmAnimalsArea
            label="Abrir curral"
            placement={{ left: "43.8%", top: "20.6%", width: "16%", height: "18%" }}
            onOpen={() => onSectionChange("animais")}
          />
          <FarmAnimalsArea
            label="Abrir galinheiro"
            placement={{ left: "72.2%", top: "40%", width: "14.2%", height: "19.2%" }}
            onOpen={() => onSectionChange("animais")}
          />

          <div className="farm-scene__plots" aria-label={`${MAX_FARM_PLOTS} espaÃ§os de canteiro`}>
            {slots.map((slot, index) => (
              <FarmPlot
                key={slot.plot?.id ?? `plot-slot-${slot.slotNumber}`}
                slot={slot}
                placement={FARM_SCENE_PLOT_LAYOUT[index]!}
                nowMs={props.nowMs}
                busy={Boolean(props.busy)}
                canHarvest={props.canHarvest}
                onInteract={interactPlot}
              />
            ))}
          </div>

          <button
            className="farm-scene__hotspot farm-scene__action farm-scene__action--plant"
            type="button"
            onClick={props.onPlantAll}
            disabled={Boolean(props.busy)}
            aria-label="Plantar nos canteiros disponÃ­veis"
            title="Plantar"
          />
          <button
            className="farm-scene__hotspot farm-scene__action farm-scene__action--harvest"
            type="button"
            onClick={props.onHarvestAll}
            disabled={Boolean(props.busy) || !props.canHarvest}
            aria-label="Colher canteiros prontos"
            title="Colher"
          />

          <button
            className="farm-scene__hotspot farm-scene__top-action farm-scene__top-action--refresh"
            type="button"
            onClick={props.onRefresh}
            disabled={Boolean(props.busy)}
            aria-label="Atualizar fazenda"
            title="Atualizar"
          >
            <span aria-hidden="true">â†»</span>
          </button>
          <button
            className="farm-scene__hotspot farm-scene__top-action farm-scene__top-action--logout"
            type="button"
            onClick={props.onLogout}
            disabled={Boolean(props.busy)}
            aria-label="Sair"
            title="Sair"
          >
            <span aria-hidden="true">Ã—</span>
          </button>

          <HUD
            userName={props.userName}
            farm={props.farm}
            plots={props.plots}
            inventory={props.inventory}
            nowMs={props.nowMs}
          />

          {props.notice || props.error ? (
            <div className="farm-scene__messages">
              {props.notice ? (
                <div className="farm-scene__toast is-success" role="status">
                  {props.notice}
                </div>
              ) : null}
              {props.error ? (
                <div className="farm-scene__toast is-error" role="alert">
                  {props.error}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}


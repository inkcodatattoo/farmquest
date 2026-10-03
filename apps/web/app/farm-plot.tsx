"use client";

import type { CSSProperties } from "react";
import { FARM_ICONS } from "./farm-icons";
import { getCropGrowthGif } from "./crop-growth-gifs";

import {
  canInteract,
  iconForPlot,
  timerText,
  type FarmPlotSlot,
} from "./farm-world-model";

type PixelIconProps = {
  src: string;
  alt?: string;
  className?: string;
};

export function PixelIcon({ src, alt = "", className = "" }: PixelIconProps) {
  return (
    <img
      className={`fq-pixel-icon ${className}`.trim()}
      src={src}
      alt={alt}
      draggable={false}
    />
  );
}

export type FarmPlotPlacement = {
  left: string;
  top: string;
  width: string;
  height: string;
};

type FarmPlotProps = {
  slot: FarmPlotSlot;
  placement: FarmPlotPlacement;
  nowMs: number;
  busy: boolean;
  canHarvest: boolean;
  onInteract: (plotId: string) => void;
};

function placementStyle(placement: FarmPlotPlacement): CSSProperties {
  return {
    "--plot-left": placement.left,
    "--plot-top": placement.top,
    "--plot-width": placement.width,
    "--plot-height": placement.height
  } as CSSProperties;
}

function plotTitle(slot: FarmPlotSlot, nowMs: number): string {
  const prefix = `Canteiro ${slot.slotNumber}`;

  switch (slot.state) {
    case "LOCKED":
      return `${prefix}: indisponível`;
    case "AVAILABLE":
      return `${prefix}: plantar`;
    case "PLANTED":
      return `${prefix}: crescendo ${slot.plot ? timerText(slot.plot, nowMs) : ""}`.trim();
    case "READY":
      return `${prefix}: colher`;
    case "ROTTEN":
      return `${prefix}: apodrecido`;
  }
}

function readyCropImage(cropName?: string | null): string | null {
  const name = (cropName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (name.includes("milho")) {
    return "/game-assets/crops/growth/milho_ready.png";
  }

  if (name.includes("trigo")) {
    return "/game-assets/crops/growth/trigo_ready.png";
  }

  if (name.includes("cenoura")) {
    return "/game-assets/crops/growth/cenoura_ready.png";
  }

  if (name.includes("morango")) {
    return "/game-assets/crops/growth/morango_ready.png";
  }

  if (name.includes("tomate")) {
    return "/game-assets/crops/growth/tomate_ready.png";
  }

  if (name.includes("batata")) {
    return "/game-assets/crops/growth/batata_ready.png";
  }

  return null;
}


export function FarmPlot({
  slot,
  placement,
  nowMs,
  busy,
  canHarvest,
  onInteract
}: FarmPlotProps) {
  const plot = slot.plot;
  const isInteractive = canInteract(slot.state, canHarvest);
  const disabled = busy || !isInteractive || !plot;
  const baseIcon =
    slot.state === "LOCKED" ? FARM_ICONS.plots.locked : FARM_ICONS.plots.empty;
  const hasCrop =
    Boolean(plot?.planted) &&
    (slot.state === "PLANTED" ||
      slot.state === "READY" ||
      slot.state === "ROTTEN");

      const growthGif =
  plot?.planted && slot.state !== "ROTTEN"
    ? getCropGrowthGif(
        plot.planted.cropName,
        plot.planted.plantedAt,
        plot.planted.growsAt,
        nowMs
      )
    : null;

const isReady = slot.state === "READY";

const readyImage =
  isReady && plot?.planted
    ? readyCropImage(plot.planted.cropName)
    : null;

const cropImage =
  readyImage ??
  growthGif ??
  (plot ? iconForPlot(plot, nowMs) : null);

const qualityClass =
  isReady && plot?.planted?.quality
    ? ` quality-${plot.planted.quality.toLowerCase()}`
    : "";


  return (
    <button
      className={`farm-scene__plot is-${slot.state.toLowerCase()}${qualityClass}`}
      style={placementStyle(placement)}
      type="button"
      onClick={() => {
        if (plot && isInteractive) onInteract(plot.id);
      }}
      disabled={disabled}
      aria-label={plotTitle(slot, nowMs)}
      title={plotTitle(slot, nowMs)}
      data-slot-number={slot.slotNumber}
    >
     
      {hasCrop && plot ? (
        <PixelIcon
  src={cropImage ?? iconForPlot(plot, nowMs)}
  alt={plot.planted?.cropName ?? ""}
  className="farm-scene__plot-crop"
/>
      ) : null}
      {slot.state === "PLANTED" && plot ? (
        <span className="farm-scene__plot-timer">
          {timerText(plot, nowMs)}
        </span>
      ) : null}
    </button>
  );
}

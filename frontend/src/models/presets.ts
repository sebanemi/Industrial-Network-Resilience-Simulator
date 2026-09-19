import { defaultRangeFor } from "../api/client";
import type { NodeType } from "../models/types";

const TRICOLOR: Record<NodeType, string> = {
  SENSOR: "#4cc2ff",
  ESP32: "#3ecf8e",
  SERVER: "#cf9de0",
};

export function nodeColor(type: NodeType): string {
  return TRICOLOR[type];
}

export function nodeRadius(type: NodeType): number {
  switch (type) {
    case "SERVER":
      return 6;
    case "ESP32":
      return 5;
    default:
      return 3.5;
  }
}

export function nodeLabel(type: NodeType): string {
  switch (type) {
    case "SERVER":
      return "Servidor";
    case "ESP32":
      return "Nodo ESP32";
    default:
      return "Sensor";
  }
}

export function defaultRangeHint(type: NodeType): number | null {
  return defaultRangeFor(type);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
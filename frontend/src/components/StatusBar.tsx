import { memo } from "react";

import { nodeLabel } from "../models/presets";
import { useApp } from "../state/store";
import { useUI } from "../state/ui";

const fmt = (n: number | null | undefined, digits = 1): string => (n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits));

function StatusBar() {
  const { state, toggleGrid, toggleRanges, toggleSnap } = useApp();
  const { cursor, scaleLabel } = useUI();

  const mode =
    state.addShapeType === "rect"
      ? "AGREGAR RECTÁNGULO"
      : state.addShapeType === "circle"
        ? "AGREGAR CÍRCULO"
        : state.addType
          ? `AGREGAR ${nodeLabel(state.addType).toUpperCase()}`
          : state.selectedId
            ? `EDITAR ${state.selectedId}`
            : "SELECCIONAR / EDITAR";

  const internet = state.sim?.internet?.available ?? true;

  return (
    <footer className="statusbar" role="status">
      <div className="sb-left">
        <span className={`sb-mode${state.addType || state.addShapeType ? " active" : ""}`}>{mode}</span>
      </div>
      <div className="sb-toggles">
        <button
          className={`sb-toggle${state.showGrid ? " on" : ""}`}
          onClick={toggleGrid}
          title="Grilla (G)"
          aria-pressed={state.showGrid}
        >
          GRID {state.showGrid ? "ON" : "OFF"}
        </button>
        <button
          className={`sb-toggle${state.showRanges ? " on" : ""}`}
          onClick={toggleRanges}
          title="Rangos de comunicación (R)"
          aria-pressed={state.showRanges}
        >
          RANGOS {state.showRanges ? "ON" : "OFF"}
        </button>
        <button
          className={`sb-toggle${state.showSnap ? " on" : ""}`}
          onClick={toggleSnap}
          title="Ajuste a cuadrícula (S)"
          aria-pressed={state.showSnap}
        >
          MAGNET {state.showSnap ? "ON" : "OFF"}
        </button>
      </div>
      <div className="sb-data">
        <span className="sb-item mono">X {fmt(cursor?.x)} m</span>
        <span className="sb-item mono">Y {fmt(cursor?.y)} m</span>
        <span className="sb-item mono">{scaleLabel ?? "—"}</span>
        <span className={`sb-item sb-internet ${internet ? "ok" : "bad"}`}>
          INTERNET {internet ? "OK" : "CAÍDO"}
        </span>
      </div>
    </footer>
  );
}

export default memo(StatusBar);
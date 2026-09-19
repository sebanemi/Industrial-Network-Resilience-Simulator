import { memo } from "react";

import { nodeLabel } from "../models/presets";
import type { NodeType } from "../models/types";
import { useApp } from "../state/store";

function Toolbar() {
  const { state, setAddType, setInternet, toggleGrid, toggleRanges } = useApp();
  const internet = state.sim?.internet?.available ?? true;

  const typeButton = (type: NodeType) => {
    const active = state.addType === type;
    return (
      <button
        className={active ? "btn add-active" : "btn"}
        onClick={() => setAddType(active ? null : type)}
      >
        + {nodeLabel(type)}
      </button>
    );
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-title">Red Industrial Resiliente</span>
        <span className="brand-sub">modelador + simulación de contingencia</span>
      </div>
      <div className="toolbar-actions">
        {typeButton("SENSOR")}
        {typeButton("ESP32")}
        {typeButton("SERVER")}
        <button className="btn" onClick={() => setAddType(null)} title="Cancelar colocación">
          Cancelar
        </button>
        <span className="sep" />
        <button className={state.showGrid ? "btn toggle-on" : "btn"} onClick={toggleGrid}>
          Grid
        </button>
        <button className={state.showRanges ? "btn toggle-on" : "btn"} onClick={toggleRanges}>
          Rangos
        </button>
        <span className="sep" />
        <button
          className={internet ? "btn btn-ok" : "btn btn-bad"}
          onClick={() => void setInternet(!internet)}
          title="Simular caída de Internet"
        >
          {internet ? "Internet: OK" : "Internet: CAÍDA"}
        </button>
      </div>
    </header>
  );
}

export default memo(Toolbar);
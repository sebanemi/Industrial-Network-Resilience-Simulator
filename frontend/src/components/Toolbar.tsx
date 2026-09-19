import { memo, useRef, type ChangeEvent } from "react";

import { api } from "../api/client";
import { nodeLabel } from "../models/presets";
import type { NodeType, StateSnapshot } from "../models/types";
import { useApp } from "../state/store";
import { useUI } from "../state/ui";
import { IconClose, IconCloud, IconCloudOff, IconEsp32, IconExport, IconGrid, IconImport, IconPdf, IconRanges, IconSensor, IconServer, IconSnap } from "./icons";

function isSnapshot(obj: unknown): obj is StateSnapshot {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const f = o.factory as Record<string, unknown> | undefined;
  const i = o.internet as Record<string, unknown> | undefined;
  return !!(
    f &&
    typeof f.width === "number" &&
    typeof f.height === "number" &&
    i &&
    typeof i.available === "boolean" &&
    Array.isArray(o.nodes)
  );
}

function Toolbar() {
  const { state, setAddType, setAddShapeType, setInternet, toggleGrid, toggleRanges, toggleSnap, refresh } = useApp();
  const { notify } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const internet = state.sim?.internet?.available ?? true;

  const typeButton = (type: NodeType) => {
    const active = state.addType === type;
    const icon =
      type === "SENSOR" ? <IconSensor size={13} /> : type === "ESP32" ? <IconEsp32 size={13} /> : <IconServer size={13} />;
    return (
      <button
        className={active ? "btn add-active has-tip" : "btn has-tip"}
        data-tip={`Agregar ${nodeLabel(type)}`}
        onClick={() => setAddType(active ? null : type)}
        aria-pressed={active}
      >
        {icon}
        <span>{nodeLabel(type)}</span>
      </button>
    );
  };

  const handleExport = () => {
    if (!state.sim) {
      notify("No hay simulación para exportar", "error");
      return;
    }
    const snapshot: StateSnapshot = {
      format: "industrial-network-simulation",
      version: 1,
      factory: state.sim.factory,
      internet: { available: state.sim.internet.available },
      nodes: state.sim.nodes,
      shapes: state.sim.shapes,
    };
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `red-industrial-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Snapshot exportado a archivo JSON", "success");
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isSnapshot(parsed)) {
        notify("Archivo inválido: no parece un snapshot de la red", "error");
        return;
      }
      await api.setState(parsed);
      notify("Simulación importada", "success");
      await refresh();
    } catch (err) {
      notify(err instanceof Error ? `No se pudo importar: ${err.message}` : "No se pudo importar", "error");
    }
  };

  const handlePdf = async () => {
    if (!state.sim) {
      notify("No hay simulación para exportar", "error");
      return;
    }
    try {
      const { exportPlantPdf } = await import("../lib/exportPdf");
      await exportPlantPdf(state.sim);
      notify("Plano generado en PDF", "success");
    } catch (err) {
      console.error("Export PDF falló:", err);
      notify(err instanceof Error ? `No se pudo generar el PDF: ${err.message}` : "No se pudo generar el PDF", "error");
    }
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
        <button
          className="btn has-tip"
          data-tip="Cancelar colocación (Esc)"
          onClick={() => {
            setAddType(null);
            setAddShapeType(null);
          }}
        >
          <IconClose size={13} />
          <span>Cancelar</span>
        </button>
        <span className="sep" />
        <button
          className={state.showGrid ? "btn toggle-on has-tip" : "btn has-tip"}
          data-tip="Mostrar grilla (G)"
          onClick={toggleGrid}
          aria-pressed={state.showGrid}
        >
          <IconGrid size={13} />
          <span>Grid</span>
        </button>
        <button
          className={state.showRanges ? "btn toggle-on has-tip" : "btn has-tip"}
          data-tip="Mostrar rangos de comunicación (R)"
          onClick={toggleRanges}
          aria-pressed={state.showRanges}
        >
          <IconRanges size={13} />
          <span>Rangos</span>
        </button>
        <button
          className={state.showSnap ? "btn toggle-on has-tip" : "btn has-tip"}
          data-tip="Ajuste a cuadrícula (S)"
          onClick={toggleSnap}
          aria-pressed={state.showSnap}
        >
          <IconSnap size={13} />
          <span>Magnet</span>
        </button>
        <span className="sep" />
        <button
          className={internet ? "btn btn-ok has-tip" : "btn btn-bad has-tip"}
          data-tip="Simular caída de Internet"
          onClick={() => {
            void setInternet(!internet);
            notify(internet ? "Simulando caída de Internet" : "Internet restablecido", internet ? "error" : "success");
          }}
        >
          {internet ? <IconCloud size={13} /> : <IconCloudOff size={13} />}
          <span>{internet ? "Internet: OK" : "Internet: CAÍDA"}</span>
        </button>
        <span className="sep" />
        <button className="btn has-tip" data-tip="Exportar snapshot (JSON guarda aparte)" onClick={handleExport}>
          <IconExport size={13} />
          <span>Exportar</span>
        </button>
        <button className="btn has-tip" data-tip="Importar snapshot (reemplaza la simulación)" onClick={() => fileRef.current?.click()}>
          <IconImport size={13} />
          <span>Importar</span>
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleImportFile} />
        <button className="btn has-tip" data-tip="Generar plano en PDF (formato profesional)" onClick={() => void handlePdf()}>
          <IconPdf size={13} />
          <span>PDF</span>
        </button>
      </div>
    </header>
  );
}

export default memo(Toolbar);
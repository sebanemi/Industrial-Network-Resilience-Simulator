import { useEffect, useState, memo } from "react";

import type { NodePatch, NodeType } from "../models/types";
import { useApp } from "../state/store";

function NodeFormPanel() {
  const { state, updateNode, deleteNode, computeRoute, select } = useApp();
  const node = state.sim?.nodes?.find((n) => n.id === state.selectedId) ?? null;

  const [name, setName] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [range, setRange] = useState("");
  const [status, setStatus] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!node) return;
    setName(node.name);
    setX(String(node.x));
    setY(String(node.y));
    setRange(node.range == null ? "" : String(node.range));
    setStatus(node.status);
    setDirty(false);
  }, [node?.id, node?.x, node?.y, node?.range, node?.status, node?.name]);

  if (!node) {
    return (
      <section className="panel">
        <div className="panel-title">
          <h2>Selección</h2>
        </div>
        <p className="field-hint">Haz clic en un dispositivo del plano para editarlo.</p>
      </section>
    );
  }

  const parseNumber = (s: string): number | null => {
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  };

  const onSave = async () => {
    const patch: NodePatch = {};
    if (name.trim() !== "" && name.trim() !== node.name) patch.name = name.trim();
    const nx = parseNumber(x);
    const ny = parseNumber(y);
    if (nx != null && nx !== node.x) patch.x = nx;
    if (ny != null && ny !== node.y) patch.y = ny;
    if (range.trim() === "") {
      if (node.range != null) patch.range = null;
    } else {
      const rv = parseNumber(range);
      if (rv != null && rv !== node.range) patch.range = rv;
    }
    if (status !== node.status) patch.status = status;
    setDirty(false);
    if (Object.keys(patch).length > 0) {
      await updateNode(node.id, patch);
    }
  };

  const typeClass: Record<NodeType, string> = {
    SENSOR: "badge-sensor",
    ESP32: "badge-esp32",
    SERVER: "badge-server",
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Nodo <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>{node.id}</span></h2>
      </div>

      <div className="field-row" style={{ marginBottom: "var(--space-md)" }}>
        <span className={`badge ${typeClass[node.type]}`}>{node.type}</span>
        {node.reachable === false && node.status === "ONLINE" && node.type !== "SERVER" && (
          <span className="badge badge-isolated">AISLADO</span>
        )}
      </div>

      <div className="field">
        <span className="field-label">Nombre</span>
        <input className="input" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} placeholder="Nombre del dispositivo" />
      </div>

      <div className="field-row">
        <div className="field">
          <span className="field-label">X (m)</span>
          <input className="input" type="number" step="0.1" value={x} onChange={(e) => { setX(e.target.value); setDirty(true); }} />
        </div>
        <div className="field">
          <span className="field-label">Y (m)</span>
          <input className="input" type="number" step="0.1" value={y} onChange={(e) => { setY(e.target.value); setDirty(true); }} />
        </div>
      </div>

      <div className="field">
        <span className="field-label">Rango (m)</span>
        <input className="input" type="number" step="0.1" min="0" placeholder="— sin rango —" value={range} onChange={(e) => { setRange(e.target.value); setDirty(true); }} />
        <span className="field-hint">Vacío = sin límite de alcance (solo SERVER/ESP32)</span>
      </div>

      <div className="field">
        <span className="field-label">Estado</span>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value as "ONLINE" | "OFFLINE"); setDirty(true); }}>
          <option value="ONLINE">ONLINE</option>
          <option value="OFFLINE">OFFLINE</option>
        </select>
      </div>

      <div className="button-row">
        <button className="btn primary" onClick={() => void onSave()} disabled={!dirty}>
          Guardar cambios
        </button>
        <button className="btn" onClick={() => void computeRoute(node.id)}>
          Calcular ruta → SERVER
        </button>
      </div>

      <button className="btn danger btn-full" onClick={() => { void deleteNode(node.id); select(null); }}>
        Eliminar nodo
      </button>
    </section>
  );
}

export default memo(NodeFormPanel);
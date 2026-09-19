import { useRef, memo, type ChangeEvent, type KeyboardEvent } from "react";

import { useApp } from "../state/store";
import { useUI } from "../state/ui";

function StatusPanel() {
  const { state, updateFactory, setRoute, computeRoute } = useApp();
  const { notify } = useUI();
  const { sim, route } = state;

  const wRef = useRef<HTMLInputElement>(null);
  const hRef = useRef<HTMLInputElement>(null);

  const onSelectChanged = (e: ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) {
      void computeRoute(e.target.value);
      notify(`Calculando ruta de ${e.target.value}…`, "info");
    }
  };

  if (!sim) {
    return (
      <section className="panel">
        <div className="panel-title"><h2>Simulación</h2></div>
        <p className="field-hint">Cargando estado…</p>
      </section>
    );
  }

  const nodes = sim.nodes ?? [];
  const connections = sim.connections ?? [];
  const isolated = sim.isolated ?? [];
  const sources = nodes.filter((n) => n.type === "SENSOR" || n.type === "ESP32");

  const applyDims = async () => {
    const nw = Number(wRef.current?.value);
    const nh = Number(hRef.current?.value);
    const patch: { width?: number; height?: number } = {};
    const fw = sim.factory?.width;
    const fh = sim.factory?.height;
    if (Number.isFinite(nw) && nw > 0 && (fw === undefined || nw !== fw)) patch.width = nw;
    if (Number.isFinite(nh) && nh > 0 && (fh === undefined || nh !== fh)) patch.height = nh;
    if (Object.keys(patch).length > 0) {
      const ok = await updateFactory(patch);
      if (ok) notify("Dimensiones actualizadas", "success");
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void applyDims();
  };

  const online = sim.internet?.available ?? true;

  return (
    <section className="panel">
      <div className="panel-title"><h2>Simulación</h2></div>

      <div className={`internet-banner ${online ? "online" : "offline"}`}>
        <div className="status">
          <span className="dot" />
          {online ? "INTERNET DISPONIBLE" : "INTERNET CAÍDO"}
        </div>
        <span className="desc">
          {online ? "Red de contingencia en standby" : "Red de contingencia activa → SERVER local"}
        </span>
      </div>

      <h3>Dimensiones de la planta</h3>
      <div className="field-row">
        <div className="field">
          <span className="field-label">Ancho (m)</span>
          <input className="input" type="number" min="10" max="1000" step="1"
            ref={wRef} defaultValue={sim.factory?.width ?? 200}
            onKeyDown={onKeyDown} />
        </div>
        <div className="field">
          <span className="field-label">Alto (m)</span>
          <input className="input" type="number" min="10" max="1000" step="1"
            ref={hRef} defaultValue={sim.factory?.height ?? 150}
            onKeyDown={onKeyDown} />
        </div>
      </div>
      <button className="btn" onClick={() => void applyDims()}>Aplicar dimensiones</button>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{nodes.length}</div>
          <div className="stat-label">Dispositivos</div>
        </div>
        <div className="stat">
          <div className="stat-value">{connections.length}</div>
          <div className="stat-label">Enlaces</div>
        </div>
        <div className="stat">
          <div className="stat-value">{isolated.length}</div>
          <div className="stat-label">Aislados</div>
        </div>
      </div>

      <h3>Calcular ruta al SERVER</h3>
      <div className="field">
        <select className="input" onChange={onSelectChanged} defaultValue="">
          <option value="" disabled>Elegir dispositivo origen…</option>
          {sources.map((n) => (
            <option key={n.id} value={n.id}>
              {n.id} ({n.type}, {n.status})
            </option>
          ))}
        </select>
      </div>

      {route && (
        <div className={`route-box ${route.reachable ? "reachable" : "unreachable"}`}>
          <div className="route-head">
            <button className="btn ghost btn-ghost" onClick={() => setRoute(null)} title="Cerrar ruta" aria-label="Cerrar ruta">×</button>
          </div>
          {route.reachable ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                <div><span className="label">Ruta:</span> <span className="value path">{route.path.join(" → ")}</span></div>
                <div><span className="label">Costo total:</span> <span className="value">{route.total_cost.toFixed(1)} m</span></div>
              </div>
            </>
          ) : (
            <p className="unreachable-msg">Inalcanzable: no hay camino de <span style={{fontFamily:"var(--font-mono)"}}>{route.source}</span> al servidor.</p>
          )}
        </div>
      )}

      <h3>Dispositivos aislados</h3>
      {isolated.length === 0 ? (
        <p className="field-hint">Todos los dispositivos alcanzan al servidor.</p>
      ) : (
        <ul className="isolated-list">
          {isolated.map((id) => (
            <li key={id} className="isolated-item">
              <span className="dot" />
              <span style={{fontFamily:"var(--font-mono)"}}>{id}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default memo(StatusPanel);
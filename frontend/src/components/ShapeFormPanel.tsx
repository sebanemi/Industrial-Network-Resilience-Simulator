import { useEffect, useState, memo, type ChangeEvent, type KeyboardEvent } from "react";

import { useApp } from "../state/store";
import { useUI } from "../state/ui";
import { IconCircle, IconRect, IconTrash } from "./icons";

function ShapeFormPanel() {
  const { state, setAddShapeType, selectShape, updateShape, deleteShape } = useApp();
  const { notify } = useUI();
  const shapes = state.sim?.shapes ?? [];
  const selected = shapes.find((s) => s.id === state.selectedShapeId) ?? null;

  const [xText, setXText] = useState("");
  const [yText, setYText] = useState("");
  const [wText, setWText] = useState("");
  const [hText, setHText] = useState("");

  useEffect(() => {
    if (!selected) {
      setXText("");
      setYText("");
      setWText("");
      setHText("");
      return;
    }
    setXText(String(selected.x));
    setYText(String(selected.y));
    setWText(String(selected.width));
    setHText(String(selected.height));
  }, [state.selectedShapeId, selected]);

  const apply = async () => {
    if (!selected) return;
    const x = Number(xText);
    const y = Number(yText);
    const w = Number(wText);
    const h = Number(hText);
    const patch: { x?: number; y?: number; width?: number; height?: number } = {};
    if (Number.isFinite(x) && x >= 0) patch.x = x;
    if (Number.isFinite(y) && y >= 0) patch.y = y;
    if (selected.type === "circle") {
      if (Number.isFinite(w) && w > 0) {
        patch.width = w;
        patch.height = w;
      }
    } else {
      if (Number.isFinite(w) && w > 0) patch.width = w;
      if (Number.isFinite(h) && h > 0) patch.height = h;
    }
    if (Object.keys(patch).length > 0) await updateShape(selected.id, patch);
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void apply();
  };
  const inputProps = (value: string, set: (v: string) => void) => ({
    type: "number" as const,
    className: "input",
    min: "0",
    step: "0.5",
    value,
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(e.target.value),
    onKeyDown: onEnter,
  });

  return (
    <section className="panel">
      <div className="panel-title"><h2>Objetos del plano</h2></div>
      <p className="field-hint">Paredes, máquinas o estructuras. Pulsá un botón y hacé clic en el plano.</p>

      <div className="field-row">
        <button
          className={state.addShapeType === "rect" ? "btn add-active has-tip" : "btn has-tip"}
          data-tip="Agregar rectángulo (pared, máquina)"
          onClick={() => setAddShapeType(state.addShapeType === "rect" ? null : "rect")}
        >
          <IconRect size={13} /> Rectángulo
        </button>
        <button
          className={state.addShapeType === "circle" ? "btn add-active has-tip" : "btn has-tip"}
          data-tip="Agregar círculo"
          onClick={() => setAddShapeType(state.addShapeType === "circle" ? null : "circle")}
        >
          <IconCircle size={13} /> Círculo
        </button>
      </div>

      {shapes.length === 0 ? (
        <p className="field-hint">Todavía no hay objetos.</p>
      ) : (
        <ul className="isolated-list">
          {shapes.map((s) => (
            <li
              key={s.id}
              className={s.id === state.selectedShapeId ? "list-item active" : "list-item"}
              onClick={() => selectShape(s.id)}
            >
              <span className="dot" />
              <span>
                {s.id} · {s.type === "rect" ? "rect" : "círculo"} {s.width.toFixed(1)}×{s.height.toFixed(1)} m
              </span>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <>
          <h3>Medidas de {selected.id}</h3>
          <div className="field-row">
            <div className="field">
              <span className="field-label">Centro X (m)</span>
              <input {...inputProps(xText, setXText)} />
            </div>
            <div className="field">
              <span className="field-label">Centro Y (m)</span>
              <input {...inputProps(yText, setYText)} />
            </div>
          </div>
          {selected.type === "rect" ? (
            <div className="field-row">
              <div className="field">
                <span className="field-label">Ancho (m)</span>
                <input {...inputProps(wText, setWText)} />
              </div>
              <div className="field">
                <span className="field-label">Alto (m)</span>
                <input {...inputProps(hText, setHText)} />
              </div>
            </div>
          ) : (
            <div className="field">
              <span className="field-label">Diámetro (m)</span>
              <input
                {...inputProps(wText, (v) => {
                  setWText(v);
                  setHText(v);
                })}
              />
            </div>
          )}
          <div className="field-row">
            <button className="btn" onClick={() => { void apply(); notify("Cambios aplicados", "success"); }}>Aplicar</button>
            <button className="btn danger" onClick={() => { void deleteShape(selected.id); notify(`${selected.id} eliminado`, "success"); }}><IconTrash size={12} /> Eliminar</button>
          </div>
          <button className="btn ghost" onClick={() => selectShape(null)}>Quitar selección</button>
        </>
      )}
    </section>
  );
}

export default memo(ShapeFormPanel);
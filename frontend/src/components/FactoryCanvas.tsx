import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent, type PointerEvent } from "react";

import { gridLines, fitView, screenToWorld, metersPerPixel, snapCoord, type Point, type Size, type ViewBox } from "../canvas/geometry";
import { usePanZoom } from "../canvas/usePanZoom";
import { nextIdFor, nextShapeId } from "../api/client";
import { nodeColor, nodeRadius, round2, defaultRangeHint, nodeLabel } from "../models/presets";
import type { NodeDto, ShapeDto } from "../models/types";
import { useApp } from "../state/store";
import { useUI } from "../state/ui";
import { IconClose, IconEsp32, IconGrid, IconRanges, IconSensor, IconServer, IconSnap } from "./icons";

interface Dragged {
  id: string;
  pointerId: number;
  lastWorld: Point;
  changed: boolean;
}

interface DerivedEdge {
  from: string;
  to: string;
  weight: number;
}

/** Deriva aristas con la misma regla que el backend: ambos ONLINE, entre en rango
 *  de los extremos que tengan range definido, y al menos uno debe tener rango. */
function deriveEdges(nodes: NodeDto[], positionOf: (node: NodeDto) => Point): DerivedEdge[] {
  const edges: DerivedEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.status !== "ONLINE" || b.status !== "ONLINE") continue;
      const hasA = a.range != null;
      const hasB = b.range != null;
      if (!hasA && !hasB) continue;
      const pa = positionOf(a);
      const pb = positionOf(b);
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if ((!hasA || d <= (a.range as number)) && (!hasB || d <= (b.range as number))) {
        edges.push({ from: a.id, to: b.id, weight: d });
      }
    }
  }
  return edges;
}

/** Símbolo de nodo (auto-contenido, sin <use>/symbol).
 *  SENSOR es una diana circular; ESP32 una placa de desarrollo (chip + pines);
 *  SERVER es una PC (monitor con base). `color` es el color del tipo (o gris si offline)
 *  y `ink` el detalle en contraste para que se lea sobre el fondo oscuro. */
function NodeGlyph({
  type,
  x,
  y,
  size,
  color,
  ink,
}: {
  type: NodeDto["type"];
  x: number;
  y: number;
  size: number;
  color: string;
  ink: string;
}) {
  const scale = size / 24;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) translate(-12, -12)`}>
      {type === "SENSOR" && (
        <g>
          <circle cx="12" cy="12" r="9.5" fill={color} />
          <circle cx="12" cy="12" r="9.5" fill="none" stroke={ink} strokeWidth={2} />
          <circle cx="12" cy="12" r="3.2" fill={ink} stroke="none" />
          <path d="M12 4.5v2.3M12 17.2v2.3M4.5 12h2.3M17.2 12h2.3" stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none" />
        </g>
      )}
      {type === "ESP32" && (
        <g>
          <rect x="3.5" y="6" width="17" height="12" rx="2" fill={color} />
          <rect x="9.5" y="9.5" width="5" height="5" rx="0.9" fill="none" stroke={ink} strokeWidth={1.6} />
          <path d="M6 6V3M12 6V3M18 6V3" stroke={ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <path d="M6 18v3M12 18v3M18 18v3" stroke={ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <circle cx="12" cy="12" r="0.6" fill={ink} stroke="none" />
        </g>
      )}
      {type === "SERVER" && (
        <g>
          <rect x="4" y="3.5" width="16" height="10.5" rx="1.5" fill={color} />
          <rect x="7" y="6" width="10" height="5.5" rx="0.6" fill="none" stroke={ink} strokeWidth={1.4} />
          <path d="M12 14v2.2M8.5 16.2h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        </g>
      )}
    </g>
  );
}

export function FactoryCanvas() {
  const { state, addNode, updateNode, select, setAddType, createShape, updateShape, selectShape, setAddShapeType } = useApp();
  const { sim } = state;

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 800, height: 600 });
  const [vb, setVb] = useState<ViewBox | null>(null);
  const [livePos, setLivePos] = useState<ReadonlyMap<string, Point>>(new Map());
  const [liveShapePos, setLiveShapePos] = useState<ReadonlyMap<string, Point>>(new Map());
  const [guides, setGuides] = useState<{ vx?: number; hy?: number }>({});
  const [onboardVisible, setOnboardVisible] = useState(true);
  const draggedRef = useRef<Dragged | null>(null);
  const dragShapeRef = useRef<Dragged | null>(null);
  const baselineMppRef = useRef(0);
  const { setCursor, setScaleLabel, notify } = useUI();

  // Observa el tamaño del contenedor.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Limpieza de refs al desmontar para evitar memory leaks
  useEffect(() => {
    return () => {
      draggedRef.current = null;
      dragShapeRef.current = null;
    };
  }, []);

  // Encuadre inicial: centrar la vista cuando sim y viewport están disponibles.
  // También re-encuadra cuando cambian las dimensiones de la planta.
  const dimsKey = sim ? `${sim.factory.width}x${sim.factory.height}` : "none";
  const prevDimsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sim) return;
    const dimensionsChanged = prevDimsKeyRef.current !== dimsKey;
    prevDimsKeyRef.current = dimsKey;
    const fit = fitView({ width: sim.factory.width, height: sim.factory.height }, viewport);
    if (dimensionsChanged) {
      baselineMppRef.current = fit.w / Math.max(viewport.width, 1);
    }
    // Centrar si no hay vista previa (recarga de página) o cambiaron las dimensiones
    setVb((prev) => {
      if (prev == null || dimensionsChanged) {
        return fit;
      }
      return prev;
    });
  }, [dimsKey, viewport]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escala actual relativa al encuadre inicial (para la barra de estado)
  useEffect(() => {
    if (vb == null || viewport.width === 0) {
      setScaleLabel(null);
      return;
    }
    const mpp = vb.w / Math.max(viewport.width, 1);
    const base = baselineMppRef.current > 0 ? baselineMppRef.current : mpp;
    const pct = Math.round((base / mpp) * 100);
    setScaleLabel(`1 m ≈ ${(1 / mpp).toFixed(1)} px · ${pct}%`);
  }, [vb, viewport, setScaleLabel]);

  const pan = usePanZoom(vb ?? fitView({ width: 100, height: 60 }, viewport), setVb, svgRef);

  const svgHandlers = {
    ...pan,
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
      pan.onPointerMove(e);
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect && vb) setCursor(screenToWorld(e.clientX, e.clientY, rect, vb));
    },
    onPointerLeave: () => {
      pan.onPointerLeave();
      setCursor(null);
    },
  };

  const nodesById = useMemo(() => new Map(sim?.nodes.map((n) => [n.id, n]) ?? []), [sim?.nodes]);
  const routeSet = useMemo(() => new Set(state.route?.path ?? []), [state.route]);
  const routeEdges = useMemo(() => {
    const path = state.route?.path ?? [];
    const pairs = new Set<string>();
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      pairs.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
    return pairs;
  }, [state.route]);

  const factory = sim?.factory ?? { width: 100, height: 60 };
  const nodes = sim?.nodes ?? [];
  const shapes = sim?.shapes ?? [];
  const grid = gridLines({ width: factory.width, height: factory.height });
  const additive = state.addType != null;
  const shapeAdditive = state.addShapeType != null;

  const positionOf = useCallback((node: NodeDto): Point => livePos.get(node.id) ?? { x: node.x, y: node.y }, [livePos]);
  const shapePositionOf = useCallback((shape: ShapeDto): Point => liveShapePos.get(shape.id) ?? { x: shape.x, y: shape.y }, [liveShapePos]);
  const edges = useMemo(() => deriveEdges(nodes, positionOf), [nodes, positionOf]);

  const onBackgroundClick = useCallback((e: MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !vb) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, vb);
    let x = Math.max(0, Math.min(factory.width, world.x));
    let y = Math.max(0, Math.min(factory.height, world.y));
    if (state.showSnap) {
      x = Math.max(0, Math.min(factory.width, snapCoord(x)));
      y = Math.max(0, Math.min(factory.height, snapCoord(y)));
    }

    if (state.addShapeType != null) {
      const id = nextShapeId(state.addShapeType, shapes);
      const isRect = state.addShapeType === "rect";
      void createShape({
        id,
        type: state.addShapeType,
        x: round2(x),
        y: round2(y),
        width: isRect ? 24 : 20,
        height: isRect ? 12 : 20,
      }).then((ok) => ok && notify(`${id} creado en el plano`, "success"));
      setAddShapeType(null);
      return;
    }

    if (state.addType == null) return;
    const type = state.addType;
    const id = nextIdFor(type, nodes);
    if (!id) return; // por ejemplo, ya existe un SERVER
    void addNode({ id, type, x: round2(x), y: round2(y), range: defaultRangeHint(type) }).then(
      (ok) => ok && notify(`${id} (${nodeLabel(type)}) agregado`, "success"),
    );
    setAddType(null);
  }, [vb, factory, state.addShapeType, state.addType, state.showSnap, shapes, nodes, createShape, setAddShapeType, addNode, setAddType, notify]);

  const onNodePointerDown = useCallback((e: PointerEvent, node: NodeDto) => {
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !vb) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, vb);
    draggedRef.current = { id: node.id, pointerId: e.pointerId, lastWorld: world, changed: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    select(node.id);
  }, [vb, select]);

  const onNodePointerMove = useCallback((e: PointerEvent, node: NodeDto) => {
    const drag = draggedRef.current;
    if (!drag || drag.id !== node.id || drag.pointerId !== e.pointerId) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !vb) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, vb);
    const dx = world.x - drag.lastWorld.x;
    const dy = world.y - drag.lastWorld.y;
    drag.lastWorld = world;
    if (dx === 0 && dy === 0) return;
    drag.changed = true;
    const prev = positionOf(node);
    let next = {
      x: Math.max(0, Math.min(factory.width, prev.x + dx)),
      y: Math.max(0, Math.min(factory.height, prev.y + dy)),
    };
    if (state.showSnap) {
      next = { x: snapCoord(next.x), y: snapCoord(next.y) };
    }
    // Guías de alineación con otros nodos (estilo CAD)
    const mpp = metersPerPixel(vb, rect.width);
    const tol = 8 * mpp;
    let vx: number | undefined;
    let hy: number | undefined;
    for (const other of nodes) {
      if (other.id === node.id) continue;
      const po = positionOf(other);
      if (Math.abs(po.x - next.x) <= tol) vx = next.x;
      if (Math.abs(po.y - next.y) <= tol) hy = next.y;
    }
    setGuides({ vx, hy });
    setLivePos((map) => new Map(map).set(node.id, next));
  }, [vb, factory, positionOf, state.showSnap, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodePointerUp = useCallback((_e: PointerEvent, node: NodeDto) => {
    const drag = draggedRef.current;
    if (!drag || drag.id !== node.id) return;
    draggedRef.current = null;
    setGuides({});
    const pos = livePos.get(node.id);
    if (drag.changed && pos) {
      void updateNode(node.id, { x: round2(pos.x), y: round2(pos.y) });
    }
    setLivePos(new Map());
  }, [livePos, updateNode]);

  const onShapePointerDown = useCallback((e: PointerEvent, shape: ShapeDto) => {
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !vb) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, vb);
    dragShapeRef.current = { id: shape.id, pointerId: e.pointerId, lastWorld: world, changed: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    selectShape(shape.id);
  }, [vb, selectShape]);

  const onShapePointerMove = useCallback((e: PointerEvent, shape: ShapeDto) => {
    const drag = dragShapeRef.current;
    if (!drag || drag.id !== shape.id || drag.pointerId !== e.pointerId) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !vb) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, vb);
    const dx = world.x - drag.lastWorld.x;
    const dy = world.y - drag.lastWorld.y;
    drag.lastWorld = world;
    if (dx === 0 && dy === 0) return;
    drag.changed = true;
    const prev = shapePositionOf(shape);
    let next = {
      x: Math.max(0, Math.min(factory.width, prev.x + dx)),
      y: Math.max(0, Math.min(factory.height, prev.y + dy)),
    };
    if (state.showSnap) {
      next = { x: snapCoord(next.x), y: snapCoord(next.y) };
    }
    setLiveShapePos((map) => new Map(map).set(shape.id, next));
  }, [vb, factory, shapePositionOf, state.showSnap]); // eslint-disable-line react-hooks/exhaustive-deps

  const onShapePointerUp = useCallback((_e: PointerEvent, shape: ShapeDto) => {
    const drag = dragShapeRef.current;
    if (!drag || drag.id !== shape.id) return;
    dragShapeRef.current = null;
    const pos = liveShapePos.get(shape.id);
    if (drag.changed && pos) {
      void updateShape(shape.id, { x: round2(pos.x), y: round2(pos.y) });
    }
    setLiveShapePos(new Map());
  }, [liveShapePos, updateShape]);

  const onShapePointerCancel = useCallback(() => {
    dragShapeRef.current = null;
    setLiveShapePos(new Map());
  }, []);

  const onNodePointerCancel = useCallback(() => {
    draggedRef.current = null;
    setGuides({});
    setLivePos(new Map());
  }, []);

  const labelVisible = (vb?.w ?? 0) / (viewport.width || 1) < 3;

  if (!sim) {
    return <div className="canvas-empty">Cargando simulación…</div>;
  }

  return (
    <div className="canvas-frame" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="factory-svg"
        viewBox={vb ? `${vb.x0} ${vb.y0} ${vb.w} ${vb.h}` : "0 0 1 1"}
        preserveAspectRatio="xMidYMid meet"
        onClick={onBackgroundClick}
        {...svgHandlers}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3ba2ff" />
          </marker>
        </defs>

        {/* Planta */}
        <rect
          x={0}
          y={0}
          width={factory.width}
          height={factory.height}
          className="plant-floor"
        />
        <rect x={0} y={0} width={factory.width} height={factory.height} className="plant-border" />

        {/* Grid */}
        {state.showGrid && (
          <g className="grid">
            {grid.minorX.map((x) => (
              <line key={`mx${x}`} x1={x} y1={0} x2={x} y2={factory.height} className="grid-minor" />
            ))}
            {grid.minorY.map((y) => (
              <line key={`my${y}`} x1={0} y1={y} x2={factory.width} y2={y} className="grid-minor" />
            ))}
            {grid.majorX.map((x) => (
              <line key={`Mx${x}`} x1={x} y1={0} x2={x} y2={factory.height} className="grid-major" />
            ))}
            {grid.majorY.map((y) => (
              <line key={`My${y}`} x1={0} y1={y} x2={factory.width} y2={y} className="grid-major" />
            ))}
          </g>
        )}

        {/* Formas (estructuras, paredes, máquinas…) */}
        <g className="shapes">
          {shapes.map((shape) => {
            const p = shapePositionOf(shape);
            const selected = state.selectedShapeId === shape.id;
            const shapeProps = {
              className: "shape",
              style: { cursor: "move" },
              onClick: (e: MouseEvent) => e.stopPropagation(),
              onPointerDown: (e: PointerEvent) => onShapePointerDown(e, shape),
              onPointerMove: (e: PointerEvent) => onShapePointerMove(e, shape),
              onPointerUp: (e: PointerEvent) => onShapePointerUp(e, shape),
              onPointerCancel: onShapePointerCancel,
            };
            return shape.type === "rect" ? (
              <g key={shape.id} {...shapeProps}>
                {selected && (
                  <rect
                    x={p.x - shape.width / 2 - 1.5}
                    y={p.y - shape.height / 2 - 1.5}
                    width={shape.width + 3}
                    height={shape.height + 3}
                    className="shape-selected"
                  />
                )}
                <rect
                  x={p.x - shape.width / 2}
                  y={p.y - shape.height / 2}
                  width={shape.width}
                  height={shape.height}
                  className="shape-rect"
                />
              </g>
            ) : (
              <g key={shape.id} {...shapeProps}>
                {selected && (
                  <circle cx={p.x} cy={p.y} r={shape.width / 2 + 1.5} className="shape-selected" />
                )}
                <circle cx={p.x} cy={p.y} r={shape.width / 2} className="shape-circle" />
              </g>
            );
          })}
        </g>

        {/* Edges (conexiones por rango, calculadas en vivo con la posición real) */}
        <g className="edges">
          {edges.map((edge) => {
            const a = nodesById.get(edge.from);
            const b = nodesById.get(edge.to);
            if (!a || !b) return null;
            const pa = positionOf(a);
            const pb = positionOf(b);
            const key = edge.from < edge.to ? `${edge.from}|${edge.to}` : `${edge.to}|${edge.from}`;
            const active = routeEdges.has(key);
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            return (
              <g key={key} className="edge">
                <line
                  x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  className={active ? "edge-line edge-active" : "edge-line"}
                  markerEnd={active ? "url(#arrow)" : undefined}
                />
                {labelVisible && (
                  <text x={mid.x} y={mid.y - 0.5} className="edge-weight">
                    {edge.weight.toFixed(1)} m
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Guías de alineación (magnet) */}
        {(guides.vx != null || guides.hy != null) && (
          <g className="guides">
            {guides.vx != null && (
              <line x1={guides.vx} y1={0} x2={guides.vx} y2={factory.height} className="guide guide-v" />
            )}
            {guides.hy != null && (
              <line x1={0} y1={guides.hy} x2={factory.width} y2={guides.hy} className="guide guide-h" />
            )}
          </g>
        )}

        {/* Rangos de comunicación */}
        {state.showRanges &&
          nodes.map((node) => {
            if (node.range == null) return null;
            const p = positionOf(node);
            return (
              <circle
                key={`range-${node.id}`}
                cx={p.x}
                cy={p.y}
                r={node.range}
                className={node.type === "SERVER" ? "range-circle range-server" : "range-circle"}
              />
            );
          })}

        {/* Regla de distancia */}
        {labelVisible && (
          <g className="ruler">
            <line x1={8} y1={factory.height - 8} x2={8 + 10} y2={factory.height - 8} />
            <text x={8} y={factory.height - 11.5}>10 m</text>
          </g>
        )}

        {/* Nodos */}
        {nodes.map((node) => {
          const p = positionOf(node);
          const selected = state.selectedId === node.id;
          const isolated = node.type !== "SERVER" && !node.reachable && node.status === "ONLINE";
          const inRoute = routeSet.has(node.id);
          const color = node.status === "OFFLINE" ? "#5b6b7b" : nodeColor(node.type);
          const ink = node.status === "OFFLINE" ? "#9aa4b2" : "#0e1013";
          const r = nodeRadius(node.type);
          const iconSize = r * 2.2;
          return (
            <g
              key={node.id}
              className={`node ${node.status === "OFFLINE" ? "node-offline" : ""}`}
              style={{ color }}
              onPointerDown={(e) => onNodePointerDown(e, node)}
              onPointerMove={(e) => onNodePointerMove(e, node)}
              onPointerUp={(e) => onNodePointerUp(e, node)}
              onPointerCancel={onNodePointerCancel}
              onClick={(e) => e.stopPropagation()}
            >
              {inRoute && <circle cx={p.x} cy={p.y} r={r + 2} className="node-glow" />}
              <NodeGlyph type={node.type} x={p.x} y={p.y} size={iconSize} color={color} ink={ink} />
              {isolated && <circle cx={p.x} cy={p.y} r={r + 1.6} className="node-isolated" />}
              {selected && <circle cx={p.x} cy={p.y} r={r + 1.6} className="node-selected" />}
            </g>
          );
        })}
      </svg>

      {additive && (
        <div className="add-hint">
          Modo agregar nodo: {state.addType}. Haz clic en el plano.
        </div>
      )}
      {shapeAdditive && (
        <div className="add-hint">
          Modo agregar {state.addShapeType === "rect" ? "rectángulo" : "círculo"}. Haz clic en el plano.
        </div>
      )}

      {onboardVisible && nodes.length === 0 && shapes.length === 0 && (
        <div className="onboard">
          <button
            className="btn icon has-tip"
            data-tip="Ocultar guía"
            onClick={() => setOnboardVisible(false)}
            aria-label="Ocultar guía"
          >
            <IconClose size={13} />
          </button>
          <h2>Plano vacío</h2>
          <p>Modelá la red de la fábrica en 3 pasos:</p>
          <ol className="onboard-steps">
            <li>Agregá el <strong>SERVER</strong> central.</li>
            <li>Distribuí sensores y nodos ESP32 por el plano.</li>
            <li>Calculá rutas al servidor y simulá caídas de Internet.</li>
          </ol>
          <div className="onboard-actions">
            <button className="btn has-tip" data-tip="Agregar nodo servidor" onClick={() => setAddType("SERVER")}>
              <IconServer size={13} /> Agregar SERVER
            </button>
            <button className="btn has-tip" data-tip="Agregar sensor" onClick={() => setAddType("SENSOR")}>
              <IconSensor size={13} /> Sensor
            </button>
            <button className="btn has-tip" data-tip="Agregar nodo ESP32" onClick={() => setAddType("ESP32")}>
              <IconEsp32 size={13} /> ESP32
            </button>
          </div>
          <div className="onboard-shortcuts">
            <span><IconGrid size={12} /> G grilla</span>
            <span><IconRanges size={12} /> R rangos</span>
            <span><IconSnap size={12} /> S magnet</span>
            <span><IconClose size={12} /> Esc cancelar</span>
          </div>
        </div>
      )}
    </div>
  );
}
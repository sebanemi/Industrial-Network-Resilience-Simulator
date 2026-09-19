import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent, type PointerEvent } from "react";

import { gridLines, fitView, screenToWorld, type Point, type Size, type ViewBox } from "../canvas/geometry";
import { usePanZoom } from "../canvas/usePanZoom";
import { nextIdFor, nextShapeId } from "../api/client";
import { nodeColor, nodeRadius, round2, defaultRangeHint } from "../models/presets";
import type { NodeDto, ShapeDto } from "../models/types";
import { useApp } from "../state/store";

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

/** Glifo inline (sin <use>/symbol) para que siempre se renderice. */
function NodeGlyph({ type, x, y, size, color }: { type: NodeDto["type"]; x: number; y: number; size: number; color: string }) {
  const scale = size / 24;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale}) translate(-12, -12)`}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {type === "SENSOR" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
        </>
      )}
      {type === "ESP32" && (
        <>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <line x1="4" y1="9" x2="1" y2="9" />
          <line x1="4" y1="15" x2="1" y2="15" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="15" x2="23" y2="15" />
          <path d="M16 16.5 A 4.5 4.5 0 0 1 12 20.5" />
          <path d="M16 12.5 A 7 7 0 0 1 12 20.5" />
          <path d="M16 8.5 A 9.5 9.5 0 0 1 12 20.5" />
          <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
        </>
      )}
      {type === "SERVER" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
          <line x1="5" y1="8" x2="19" y2="8" />
          <line x1="5" y1="12" x2="19" y2="12" />
          <line x1="5" y1="16" x2="19" y2="16" />
          <circle cx="19.5" cy="6" r="1.2" fill="#34d399" stroke="none" />
          <circle cx="19.5" cy="12" r="1.2" fill="#34d399" stroke="none" />
          <circle cx="19.5" cy="18" r="1.2" fill="#cbd5e1" stroke="none" />
        </>
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
  const draggedRef = useRef<Dragged | null>(null);
  const dragShapeRef = useRef<Dragged | null>(null);

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
    // Centrar si no hay vista previa (recarga de página) o cambiaron las dimensiones
    setVb((prev) => {
      if (prev == null || dimensionsChanged) {
        return fitView({ width: sim.factory.width, height: sim.factory.height }, viewport);
      }
      return prev;
    });
  }, [dimsKey, viewport]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = usePanZoom(vb ?? fitView({ width: 100, height: 60 }, viewport), setVb, svgRef);

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

  if (!sim) {
    return <div className="canvas-empty">Cargando simulación…</div>;
  }

  const factory = sim.factory ?? { width: 100, height: 60 };
  const nodes = sim.nodes ?? [];
  const shapes = sim.shapes ?? [];
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
    const x = Math.max(0, Math.min(factory.width, world.x));
    const y = Math.max(0, Math.min(factory.height, world.y));

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
      });
      setAddShapeType(null);
      return;
    }

    if (state.addType == null) return;
    const id = nextIdFor(state.addType, nodes);
    if (!id) return; // por ejemplo, ya existe un SERVER
    void addNode({ id, type: state.addType, x: round2(x), y: round2(y), range: defaultRangeHint(state.addType) });
    setAddType(null);
  }, [vb, factory, state.addShapeType, state.addType, shapes, nodes, createShape, setAddShapeType, addNode, setAddType]);

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
    const next = {
      x: Math.max(0, Math.min(factory.width, prev.x + dx)),
      y: Math.max(0, Math.min(factory.height, prev.y + dy)),
    };
    setLivePos((map) => new Map(map).set(node.id, next));
  }, [vb, factory, positionOf]);

  const onNodePointerUp = useCallback((_e: PointerEvent, node: NodeDto) => {
    const drag = draggedRef.current;
    if (!drag || drag.id !== node.id) return;
    draggedRef.current = null;
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
    const next = {
      x: Math.max(0, Math.min(factory.width, prev.x + dx)),
      y: Math.max(0, Math.min(factory.height, prev.y + dy)),
    };
    setLiveShapePos((map) => new Map(map).set(shape.id, next));
  }, [vb, factory, shapePositionOf]);

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
    setLivePos(new Map());
  }, []);

  const labelVisible = (vb?.w ?? 0) / (viewport.width || 1) < 3;

  return (
    <div className="canvas-frame" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="factory-svg"
        viewBox={vb ? `${vb.x0} ${vb.y0} ${vb.w} ${vb.h}` : "0 0 1 1"}
        preserveAspectRatio="xMidYMid meet"
        onClick={onBackgroundClick}
        {...pan}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffb74d" />
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
          const color = nodeColor(node.type);
          const glyphColor = node.status === "OFFLINE" ? "#64748b" : color;
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
              <circle cx={p.x} cy={p.y} r={r} fill={color} className="node-body" />
              <NodeGlyph type={node.type} x={p.x} y={p.y} size={iconSize} color={glyphColor} />
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
    </div>
  );
}
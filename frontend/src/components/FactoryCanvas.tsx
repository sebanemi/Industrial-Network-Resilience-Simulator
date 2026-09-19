import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";

import { gridLines, fitView, screenToWorld, type Point, type Size, type ViewBox } from "../canvas/geometry";
import { usePanZoom } from "../canvas/usePanZoom";
import { nextIdFor } from "../api/client";
import { nodeColor, nodeRadius, round2, defaultRangeHint } from "../models/presets";
import type { NodeDto } from "../models/types";
import { useApp } from "../state/store";

interface Dragged {
  id: string;
  pointerId: number;
  lastWorld: Point;
  changed: boolean;
}

export function FactoryCanvas() {
  const { state, addNode, updateNode, select, setAddType } = useApp();
  const { sim } = state;

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 800, height: 600 });
  const [vb, setVb] = useState<ViewBox | null>(null);
  const [livePos, setLivePos] = useState<ReadonlyMap<string, Point>>(new Map());
  const draggedRef = useRef<Dragged | null>(null);

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

  // Encuadre inicial / re-encuadre cuando cambian las dimensiones de la planta.
  const dimsKey = sim ? `${sim.factory.width}x${sim.factory.height}` : "none";
  useEffect(() => {
    if (!sim) return;
    setVb(fitView({ width: sim.factory.width, height: sim.factory.height }, viewport));
  }, [dimsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si aún no hay vista (primer render), encuadrar cuando se conoce el viewport.
  useEffect(() => {
    if (!sim) return;
    setVb((prev) => (prev == null ? fitView({ width: sim.factory.width, height: sim.factory.height }, viewport) : prev));
  }, [viewport]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const connections = sim.connections ?? [];
  const nodes = sim.nodes ?? [];
  const grid = gridLines({ width: factory.width, height: factory.height });
  const additive = state.addType != null;

  const positionOf = (node: NodeDto): Point => livePos.get(node.id) ?? { x: node.x, y: node.y };

  const onBackgroundClick = (e: MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !vb) return;
    if (state.addType == null) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, vb);
    const x = Math.max(0, Math.min(factory.width, world.x));
    const y = Math.max(0, Math.min(factory.height, world.y));
    const id = nextIdFor(state.addType, nodes);
    if (!id) return; // por ejemplo, ya existe un SERVER
    void addNode({ id, type: state.addType, x: round2(x), y: round2(y), range: defaultRangeHint(state.addType) });
    setAddType(null);
  };

  const onNodePointerDown = (e: PointerEvent, node: NodeDto) => {
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !vb) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, vb);
    draggedRef.current = { id: node.id, pointerId: e.pointerId, lastWorld: world, changed: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    select(node.id);
  };

  const onNodePointerMove = (e: PointerEvent, node: NodeDto) => {
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
  };

  const onNodePointerUp = (_e: PointerEvent, node: NodeDto) => {
    const drag = draggedRef.current;
    if (!drag || drag.id !== node.id) return;
    draggedRef.current = null;
    const pos = livePos.get(node.id);
    if (drag.changed && pos) {
      void updateNode(node.id, { x: round2(pos.x), y: round2(pos.y) });
    }
    setLivePos(new Map());
  };

  const labelVisible = (vb?.w ?? 0) / (viewport.width || 1) < 3;

  return (
    <div className="canvas-frame" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="factory-svg"
        viewBox={vb ? `${vb.x0} ${vb.y0} ${vb.w} ${vb.h}` : "0 0 1 1"}
        preserveAspectRatio="none"
        onClick={onBackgroundClick}
        {...pan}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffb74d" />
          </marker>

          {/* Símbolos de nodos (viewBox 24x24, se escalan con el radio) */}
          <symbol id="icon-sensor" viewBox="0 0 24 24">
            {/* Sensor: círculo con punto central y 4 rayos */}
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <g stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </g>
          </symbol>

          <symbol id="icon-esp32" viewBox="0 0 24 24">
            {/* ESP32: chip con antena WiFi */}
            <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
            <g stroke="currentColor" stroke-width="1" stroke-linecap="round">
              {/* Pines laterales */}
              <line x1="4" y1="9" x2="1" y2="9" />
              <line x1="4" y1="15" x2="1" y2="15" />
              <line x1="20" y1="9" x2="23" y2="9" />
              <line x1="20" y1="15" x2="23" y2="15" />
            </g>
            {/* Antena WiFi: 3 arcos */}
            <g stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round">
              <path d="M16 16.5 A 4.5 4.5 0 0 1 12 20.5" />
              <path d="M16 12.5 A 7 7 0 0 1 12 20.5" />
              <path d="M16 8.5 A 9.5 9.5 0 0 1 12 20.5" />
            </g>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </symbol>

          <symbol id="icon-server" viewBox="0 0 24 24">
            {/* Servidor: rack con 3 unidades y luces */}
            <rect x="3" y="3" width="18" height="18" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" />
            <g stroke="currentColor" stroke-width="1">
              <line x1="5" y1="8" x2="19" y2="8" />
              <line x1="5" y1="12" x2="19" y2="12" />
              <line x1="5" y1="16" x2="19" y2="16" />
            </g>
            {/* Luces de actividad */}
            <circle cx="19.5" cy="6" r="1.2" fill="#4ec9b0" />
            <circle cx="19.5" cy="12" r="1.2" fill="#4ec9b0" />
            <circle cx="19.5" cy="18" r="1.2" fill="#d4d4d4" />
          </symbol>
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

        {/* Edges (conexiones derivadas) */}
        <g className="edges">
          {connections.map((edge) => {
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
                  <text x={mid.x} y={mid.y - 1} className="edge-weight">
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
          const r = nodeRadius(node.type);
          const iconId = node.type === "SENSOR" ? "icon-sensor" : node.type === "ESP32" ? "icon-esp32" : "icon-server";
          const iconSize = r * 2.2;
          return (
            <g
              key={node.id}
              className={`node ${node.status === "OFFLINE" ? "node-offline" : ""}`}
              onPointerDown={(e) => onNodePointerDown(e, node)}
              onPointerMove={(e) => onNodePointerMove(e, node)}
              onPointerUp={(e) => onNodePointerUp(e, node)}
              onPointerCancel={() => {
                draggedRef.current = null;
                setLivePos(new Map());
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {inRoute && <circle cx={p.x} cy={p.y} r={r + 2} className="node-glow" />}
              <circle cx={p.x} cy={p.y} r={r} fill={color} className="node-body" />
              <use
                href={`#${iconId}`}
                x={p.x - iconSize / 2}
                y={p.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                fill="none"
                style={{ color: node.status === "OFFLINE" ? "#57626e" : color }}
              />
              {isolated && <circle cx={p.x} cy={p.y} r={r + 1.6} className="node-isolated" />}
              {selected && <circle cx={p.x} cy={p.y} r={r + 1.6} className="node-selected" />}
            </g>
          );
        })}
      </svg>

      {additive && (
        <div className="add-hint">
          Modo agregar: {state.addType}. Haz clic en el plano.
        </div>
      )}
    </div>
  );
}
import { useCallback, useRef, type PointerEvent, type WheelEvent } from "react";

import type { ViewBox } from "./geometry";
import { metersPerPixel, panBy, screenToWorld, zoomAt } from "./geometry";

export interface PanZoomHandlers {
  onWheel: (e: WheelEvent<SVGSVGElement>) => void;
  onPointerDown: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
}

/**
 * Hook de pan/zoom sobre el plano (rueda = zoom al cursor, arrastre sobre el
 * fondo = pan). Las coordenadas se convierten entre pantalla y metros con la
 * misma convención que el viewBox del SVG.
 */
export function usePanZoom(
  vb: ViewBox,
  setVb: (vb: ViewBox) => void,
  svgRef: React.RefObject<SVGSVGElement>,
  enabled = true,
): PanZoomHandlers {
  const panning = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  const lastSetVb = useRef(vb);
  lastSetVb.current = vb;

  const onWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      if (!enabled) return;
      e.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const world = screenToWorld(e.clientX, e.clientY, rect, lastSetVb.current);
      setVb(zoomAt(lastSetVb.current, factor, world.x, world.y));
    },
    [enabled, setVb, svgRef],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (!enabled) return;
      panning.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      if (!enabled || !panning.current || panning.current.pointerId !== e.pointerId) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mpp = metersPerPixel(lastSetVb.current, rect.width);
      const dx = (e.clientX - panning.current.startX) * mpp;
      const dy = (e.clientY - panning.current.startY) * mpp;
      panning.current.startX = e.clientX;
      panning.current.startY = e.clientY;
      setVb(panBy(lastSetVb.current, -dx, -dy));
    },
    [enabled, setVb, svgRef],
  );

  const onPointerUp = useCallback(() => {
    panning.current = null;
  }, []);

  const onPointerLeave = onPointerUp;

  return { onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerLeave };
}

export type { ViewBox };
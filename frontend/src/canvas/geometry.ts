// Geometría del plano: el SVG trabaja directamente en metros.
// La vista se controla con un viewBox (x0, y0, w, h en metros).

export interface ViewBox {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const KM_PER_PX_DEFAULT = 0.3; // metros por píxel al hacer fit (referencia)
export const SPACING_M = 20; // menor espaciado de grid (metros)
export const MAJOR_EVERY = 1; // una línea mayor cada espacio
export const MARGIN_M = 30; // margen alrededor de la planta al encuadrar

/** Encuadra la planta completa dentro del viewport (svg en px). */
export function fitView(factory: Size, viewport: Size): ViewBox {
  const marginPx = 60;
  const availW = Math.max(viewport.width - marginPx * 2, 1);
  const availH = Math.max(viewport.height - marginPx * 2, 1);
  const scale = Math.min(availW / factory.width, availH / factory.height);
  const w = factory.width * scale;
  const h = factory.height * scale;
  const x0 = (viewport.width - w) / 2;
  const y0 = (viewport.height - h) / 2;
  return { x0, y0, w, h };
}

/** Aplica zoom alrededor de un punto focal (en metros). */
export function zoomAt(vb: ViewBox, factor: number, cx: number, cy: number): ViewBox {
  const nw = vb.w / factor;
  const nh = vb.h / factor;
  // Mantener el punto focal fijo en pantalla:
  const relX = (cx - vb.x0) / vb.w;
  const relY = (cy - vb.y0) / vb.h;
  return { x0: cx - relX * nw, y0: cy - relY * nh, w: nw, h: nh };
}

/** Desplaza la vista en metros (positivo = contenido se mueve en la dirección). */
export function panBy(vb: ViewBox, dxM: number, dyM: number): ViewBox {
  return { ...vb, x0: vb.x0 + dxM, y0: vb.y0 + dyM };
}

/** Convierte coordenadas de pantalla (relativas al elemento SVG) a metros. */
export function screenToWorld(clientX: number, clientY: number, rect: DOMRect, vb: ViewBox): Point {
  const x = vb.x0 + ((clientX - rect.left) / rect.width) * vb.w;
  const y = vb.y0 + ((clientY - rect.top) / rect.height) * vb.h;
  return { x, y };
}

/** Metros por píxel actuales (para convertir arrastres en metros). */
export function metersPerPixel(vb: ViewBox, rectWidth: number): number {
  return vb.w / rectWidth;
}

export interface GridLines {
  majorX: number[];
  majorY: number[];
  minorX: number[];
  minorY: number[];
}

/** Líneas de grid dentro de la planta. */
export function gridLines(factory: Size, spacingM: number = SPACING_M): GridLines {
  const majorX: number[] = [];
  const majorY: number[] = [];
  const minorX: number[] = [];
  const minorY: number[] = [];
  for (let x = 0; x <= factory.width; x += spacingM) {
    if (Math.round(x / spacingM) % MAJOR_EVERY === 0) majorX.push(x);
    else minorX.push(x);
  }
  for (let y = 0; y <= factory.height; y += spacingM) {
    if (Math.round(y / spacingM) % MAJOR_EVERY === 0) majorY.push(y);
    else minorY.push(y);
  }
  return { majorX, majorY, minorX, minorY };
}
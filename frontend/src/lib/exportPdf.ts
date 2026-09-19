import { jsPDF } from "jspdf";
import type { SimulationDto } from "../models/types";

const FONT = "'JetBrains Mono', monospace";

function pxToM(m0: number, px: number): string {
  return (px / m0).toFixed(4);
}

function exportCss(m0: number): string {
  const m = (px: number) => pxToM(m0, px);
  return `
  .plant-floor { fill: #16191e; }
  .plant-border { fill: none; stroke: #4a515c; stroke-width: ${m(3)}; }
  .grid line { vector-effect: none; }
  .grid-minor { stroke: #212832; stroke-width: ${m(1)}; vector-effect: none; }
  .grid-major { stroke: #333a44; stroke-width: ${m(2)}; vector-effect: none; }
  .edges .edge-line { stroke: #5a6878; stroke-width: ${m(2.5)}; stroke-linecap: round; vector-effect: none; }
  .edges .edge-active { stroke: #3ba2ff; stroke-width: ${m(3.5)}; }
  .edge-weight { fill: #9099a6; font-size: ${m(2.3)}; font-family: ${FONT}; font-weight: 500; text-anchor: middle; paint-order: stroke; stroke: #0e1013; stroke-width: ${m(2)}; stroke-linejoin: round; }
  .range-circle { fill: rgba(59,162,255,0.07); stroke: rgba(59,162,255,0.45); stroke-width: ${m(1.5)}; stroke-dasharray: ${m(6)} ${m(4)}; vector-effect: none; opacity: 0.9; }
  .range-server { fill: rgba(245,158,11,0.07); stroke: rgba(245,158,11,0.45); opacity: 0.9; }
  .shape-rect { fill: rgba(148,163,184,0.12); stroke: #7a8ba0; stroke-width: ${m(2)}; vector-effect: none; }
  .shape-circle { fill: rgba(148,163,184,0.12); stroke: #7a8ba0; stroke-width: ${m(2)}; vector-effect: none; }
  .shape-selected { fill: none; stroke: #e8a33d; stroke-width: ${m(2)}; stroke-dasharray: ${m(6)} ${m(4)}; vector-effect: none; }
  .ruler line { stroke: #5e6774; stroke-width: ${m(2)}; vector-effect: none; }
  .ruler text { fill: #5e6774; font-size: ${m(3)}; font-family: ${FONT}; vector-effect: none; }
  .node-glow, .node-isolated, .node-selected, .guide { display: none; }
  text { font-family: ${FONT}; }
  `;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("no se pudo rasterizar el plano"));
    img.src = url;
  });
}

function stamp(): { file: string; label: string } {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const file = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const label = `${file} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { file, label };
}

async function renderSvgToCanvas(sim: SimulationDto): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const svg = document.querySelector<SVGSVGElement>(".factory-svg");
  if (!svg) throw new Error("el plano aún no está listo para exportar");

  const w = Math.max(1, sim.factory.width);
  const h = Math.max(1, sim.factory.height);
  const m0 = 800 / w;

  let density = 2400 / w;
  density = Math.min(5200 / w, Math.max(1200 / w, density));
  if (h * density > 6200) density = 6200 / h;
  const width = Math.max(1, Math.round(w * density));
  const height = Math.max(1, Math.round(h * density));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = exportCss(m0);
  clone.insertBefore(style, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = await loadImage(url);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no se pudo crear el lienzo de dibujo");
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

export async function exportPlantPdf(sim: SimulationDto): Promise<void> {
  const nodes = sim.nodes ?? [];
  const connections = sim.connections ?? [];
  const isolated = sim.isolated ?? [];
  const internetOk = sim.internet?.available ?? true;
  const { canvas, width, height } = await renderSvgToCanvas(sim);
  const dataUrl = canvas.toDataURL("image/png");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;

  const dark: [number, number, number] = [26, 29, 34];
  const gray: [number, number, number] = [94, 103, 116];
  const accent: [number, number, number] = [59, 162, 255];

  const date = stamp();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...dark);
  doc.text("Industrial Network Resilience Simulator", margin, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...gray);
  doc.text("Plano de planta · Modelado de red · Simulación de contingencia", margin, 31);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text(date.label, pageW - margin, 23, { align: "right" });

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.9);
  doc.line(margin, 39, pageW - margin, 39);

  const frameX = margin;
  const frameY = 46;
  const frameW = pageW - 2 * margin;
  const frameH = 131;
  doc.setDrawColor(45, 52, 62);
  doc.setLineWidth(0.7);
  doc.rect(frameX, frameY, frameW, frameH);

  const iwmm = (width * 25.4) / 300;
  const ihmm = (height * 25.4) / 300;
  const scale = Math.min((frameW - 8) / iwmm, (frameH - 8) / ihmm);
  const dw = iwmm * scale;
  const dh = ihmm * scale;
  doc.addImage(dataUrl, "PNG", frameX + (frameW - dw) / 2, frameY + (frameH - dh) / 2, dw, dh);

  doc.setDrawColor(44, 49, 57);
  doc.setLineWidth(0.5);
  doc.line(margin, 184, pageW - margin, 184);

  const counts = { SENSOR: 0, ESP32: 0, SERVER: 0 } as Record<string, number>;
  for (const n of nodes) counts[n.type] = (counts[n.type] ?? 0) + 1;

  const legend: Array<{ color: [number, number, number]; label: string }> = [
    { color: [59, 162, 255], label: `Sensor industrial · ${counts.SENSOR}` },
    { color: [62, 207, 142], label: `ESP32 · ${counts.ESP32}` },
    { color: [245, 158, 11], label: `Servidor (ruteo) · ${counts.SERVER}` },
  ];
  doc.setFontSize(9);
  let lx = margin;
  const ly = 190.5;
  for (const item of legend) {
    doc.setFillColor(...item.color);
    doc.rect(lx, ly - 3, 3.4, 3.4, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    doc.text(item.label, lx + 5.4, ly);
    lx += doc.getTextWidth(item.label) + 12;
  }

  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(
    `Dispositivos: ${nodes.length} · Enlaces: ${connections.length} · Aislados: ${isolated.length}`,
    margin,
    199
  );

  doc.text("Cuadrícula 5 m · Medidas en metros · Proporciones relativas", pageW / 2, 199, { align: "center" });

  const internetLabel = internetOk ? "Internet: OK" : "Internet: CAÍDA · contingencia";
  doc.setFont("helvetica", "bold");
  doc.setTextColor(internetOk ? 13 : 220, internetOk ? 148 : 38, internetOk ? 74 : 38);
  doc.text(internetLabel, pageW - margin, 199, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(`Generado: ${date.label}`, margin, 206);
  doc.text("Industrial Network Resilience Simulator · Plano de red", pageW - margin, 206, { align: "right" });

  doc.save(`plano-red-industrial-${date.file}.pdf`);
}
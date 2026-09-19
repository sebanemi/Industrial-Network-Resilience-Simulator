import type {
  ConnectionDto,
  FactoryDto,
  FactoryPatch,
  NewNodePayload,
  NewShapePayload,
  NodeDto,
  NodePatch,
  NodeStatus,
  NodeType,
  RouteDto,
  ShapeDto,
  ShapeType,
  SimulationDto,
} from "../models/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError(0, "No se pudo contactar al backend");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export const api = {
  getSimulation: () => request<SimulationDto>("/simulation"),
  getFactory: () => request<FactoryDto>("/factory"),
  updateFactory: (patch: FactoryPatch) =>
    request<FactoryDto>("/factory", { method: "PUT", body: JSON.stringify(patch) }),
  setInternet: (available: boolean) =>
    request<{ internet: { available: boolean; contingencyEngaged: boolean } }>(
      "/internet",
      { method: "POST", body: JSON.stringify({ available }) },
    ),
  listNodes: () => request<NodeDto[]>("/nodes"),
  createNode: (payload: NewNodePayload) =>
    request<NodeDto>("/nodes", { method: "POST", body: JSON.stringify(payload) }),
  updateNode: (id: string, patch: NodePatch) =>
    request<NodeDto>(`/nodes/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteNode: (id: string) => request<void>(`/nodes/${id}`, { method: "DELETE" }),
  getConnections: () => request<ConnectionDto[]>("/connections"),
  computeRoute: (source: string) =>
    request<RouteDto>("/routes", { method: "POST", body: JSON.stringify({ source }) }),
  listShapes: () => request<ShapeDto[]>("/shapes"),
  createShape: (payload: NewShapePayload) =>
    request<ShapeDto>("/shapes", { method: "POST", body: JSON.stringify(payload) }),
  updateShape: (id: string, payload: ShapeDto) =>
    request<ShapeDto>(`/shapes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteShape: (id: string) => request<void>(`/shapes/${id}`, { method: "DELETE" }),
};

export function defaultRangeFor(type: NodeType): number | null {
  switch (type) {
    case "ESP32":
      return 25;
    case "SERVER":
      return 50;
    default:
      return null;
  }
}

export function nextIdFor(type: NodeType, nodes: NodeDto[]): string {
  if (type === "SERVER") {
    if (nodes.some((n) => n.type === "SERVER")) return "";
    return "SERVER";
  }
  const prefix = type === "SENSOR" ? "SENSOR" : "ESP";
  let n = 1;
  while (nodes.some((node) => node.id === `${prefix}-${String(n).padStart(2, "0")}`)) {
    n += 1;
  }
  return `${prefix}-${String(n).padStart(2, "0")}`;
}

export function nextShapeId(type: ShapeType, shapes: ShapeDto[]): string {
  const prefix = type === "rect" ? "RECT" : "CIRC";
  let n = 1;
  while (shapes.some((shape) => shape.id === `${prefix}-${String(n).padStart(2, "0")}`)) {
    n += 1;
  }
  return `${prefix}-${String(n).padStart(2, "0")}`;
}

export function prettyStatus(status: NodeStatus): string {
  return status === "ONLINE" ? "ONLINE" : "OFFLINE";
}
export type NodeType = "SENSOR" | "ESP32" | "SERVER";
export type NodeStatus = "ONLINE" | "OFFLINE";
export type ShapeType = "rect" | "circle";

export interface NodeDto {
  id: string;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  range: number | null;
  status: NodeStatus;
  reachable?: boolean;
}

export interface InternetDto {
  available: boolean;
  contingencyEngaged: boolean;
}

export interface ConnectionDto {
  from: string;
  to: string;
  weight: number;
}

export interface RouteDto {
  source: string;
  destination: string;
  reachable: boolean;
  total_cost: number;
  path: string[];
}

export interface FactoryDto {
  width: number;
  height: number;
  internetAvailable: boolean;
}

export interface ShapeDto {
  id: string;
  type: ShapeType;
  x: number; // centro (m)
  y: number; // centro (m)
  width: number; // ancho (m); para circle es el diámetro
  height: number; // alto (m)
}

export interface SimulationDto {
  factory: { width: number; height: number };
  internet: InternetDto;
  nodes: NodeDto[];
  connections: ConnectionDto[];
  isolated: string[];
  shapes: ShapeDto[];
}

export interface NewNodePayload {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  name?: string;
  range?: number | null;
  status?: NodeStatus;
}

export interface NewShapePayload {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShapePatch {
  type?: ShapeType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface NodePatch {
  name?: string;
  x?: number;
  y?: number;
  range?: number | null;
  status?: NodeStatus;
}

export interface FactoryPatch {
  width?: number;
  height?: number;
  internetAvailable?: boolean;
}

export interface StateSnapshot {
  format?: "industrial-network-simulation";
  version?: number;
  factory: { width: number; height: number };
  internet: { available: boolean };
  nodes: NodeDto[];
  shapes: ShapeDto[];
}
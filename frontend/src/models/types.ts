export type NodeType = "SENSOR" | "ESP32" | "SERVER";
export type NodeStatus = "ONLINE" | "OFFLINE";

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

export interface SimulationDto {
  factory: { width: number; height: number };
  internet: InternetDto;
  nodes: NodeDto[];
  connections: ConnectionDto[];
  isolated: string[];
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
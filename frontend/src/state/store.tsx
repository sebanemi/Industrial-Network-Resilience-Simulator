import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api } from "../api/client";
import type {
  FactoryPatch,
  NewNodePayload,
  NewShapePayload,
  NodeDto,
  NodePatch,
  NodeType,
  RouteDto,
  ShapePatch,
  ShapeType,
  SimulationDto,
} from "../models/types";

export interface AppState {
  sim: SimulationDto | null;
  loading: boolean;
  loadingOperation: string | null; // Descripción de la operación en curso
  error: string | null;
  selectedId: string | null;
  selectedShapeId: string | null;
  route: RouteDto | null;
  addType: NodeType | null;
  addShapeType: ShapeType | null;
  showGrid: boolean;
  showRanges: boolean;
  showSnap: boolean;
}

const initialState: AppState = {
  sim: null,
  loading: true,
  loadingOperation: null,
  error: null,
  selectedId: null,
  selectedShapeId: null,
  route: null,
  addType: null,
  addShapeType: null,
  showGrid: true,
  showRanges: true,
  showSnap: true,
};

export interface AppContextValue {
  state: AppState;
  refresh: () => Promise<void>;
  addNode: (payload: NewNodePayload) => Promise<boolean>;
  updateNode: (id: string, patch: NodePatch) => Promise<boolean>;
  deleteNode: (id: string) => Promise<boolean>;
  updateFactory: (patch: FactoryPatch) => Promise<boolean>;
  setInternet: (available: boolean) => Promise<boolean>;
  computeRoute: (source: string) => Promise<boolean>;
  select: (id: string | null) => void;
  setAddType: (t: NodeType | null) => void;
  setRoute: (r: RouteDto | null) => void;
  toggleGrid: () => void;
  toggleRanges: () => void;
  toggleSnap: () => void;
  nodesById: () => Map<string, NodeDto>;
  createShape: (payload: NewShapePayload) => Promise<boolean>;
  updateShape: (id: string, patch: ShapePatch) => Promise<boolean>;
  deleteShape: (id: string) => Promise<boolean>;
  selectShape: (id: string | null) => void;
  setAddShapeType: (t: ShapeType | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, loadingOperation: "Cargando simulación", error: null }));
    try {
      const sim = await api.getSimulation();
      setState((s) => ({ ...s, sim, loading: false, loadingOperation: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        loadingOperation: null,
        error: err instanceof Error ? err.message : "Error desconocido",
      }));
    }
  }, []);

  const runMutation = useCallback(
    async <T,>(action: () => Promise<T>, operationName: string = "Procesando"): Promise<boolean> => {
      setState((s) => ({ ...s, loading: true, loadingOperation: operationName, error: null }));
      try {
        await action();
        await refresh();
        return true;
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          loadingOperation: null,
          error: err instanceof Error ? err.message : "Error desconocido",
        }));
        return false;
      }
    },
    [refresh],
  );

  const addNode = useCallback(
    (payload: NewNodePayload) =>
      runMutation(() => api.createNode(payload).then(() => undefined), "Agregando nodo"),
    [runMutation],
  );

  const updateNode = useCallback(
    (id: string, patch: NodePatch) =>
      runMutation(() => api.updateNode(id, patch).then(() => undefined), "Actualizando nodo"),
    [runMutation],
  );

  const deleteNode = useCallback(
    (id: string) => runMutation(() => api.deleteNode(id), "Eliminando nodo"),
    [runMutation],
  );

  const createShape = useCallback(
    (payload: NewShapePayload) =>
      runMutation(() => api.createShape(payload).then(() => undefined), "Creando forma"),
    [runMutation],
  );

  const updateShape = useCallback(
    async (id: string, patch: ShapePatch): Promise<boolean> => {
      const existing = (stateRef.current.sim?.shapes ?? []).find((s) => s.id === id);
      if (!existing) return false;
      return runMutation(() => api.updateShape(id, { ...existing, ...patch }), "Actualizando forma");
    },
    [runMutation],
  );

  const deleteShape = useCallback(
    (id: string) => runMutation(() => api.deleteShape(id), "Eliminando forma"),
    [runMutation],
  );

  const updateFactory = useCallback(
    (patch: FactoryPatch) => runMutation(() => api.updateFactory(patch), "Actualizando dimensión"),
    [runMutation],
  );

  const setInternet = useCallback(
    (available: boolean) => runMutation(() => api.setInternet(available), "Cambiando estado de Internet"),
    [runMutation],
  );

  const computeRoute = useCallback(async (source: string) => {
    try {
      const route = await api.computeRoute(source);
      setState((s) => ({ ...s, route, error: null }));
      return true;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Error desconocido",
      }));
      return false;
    }
  }, []);

  const select = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedId: id, addType: null, selectedShapeId: null, addShapeType: null }));
  }, []);

  const setAddType = useCallback((t: NodeType | null) => {
    setState((s) => ({ ...s, addType: t, selectedId: null, selectedShapeId: null, addShapeType: null }));
  }, []);

  const selectShape = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedShapeId: id, addShapeType: null, selectedId: null, addType: null }));
  }, []);

  const setAddShapeType = useCallback((t: ShapeType | null) => {
    setState((s) => ({ ...s, addShapeType: t, addType: null, selectedId: null, selectedShapeId: null }));
  }, []);

  const setRoute = useCallback((r: RouteDto | null) => {
    setState((s) => ({ ...s, route: r }));
  }, []);

  const toggleGrid = useCallback(
    () => setState((s) => ({ ...s, showGrid: !s.showGrid })),
    [],
  );
  const toggleRanges = useCallback(
    () => setState((s) => ({ ...s, showRanges: !s.showRanges })),
    [],
  );
  const toggleSnap = useCallback(
    () => setState((s) => ({ ...s, showSnap: !s.showSnap })),
    [],
  );

  const nodesById = useCallback(() => {
    const map = new Map<string, NodeDto>();
    for (const node of stateRef.current.sim?.nodes ?? []) {
      map.set(node.id, node);
    }
    return map;
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      refresh,
      addNode,
      updateNode,
      deleteNode,
      updateFactory,
      setInternet,
      computeRoute,
      select,
      setAddType,
      setRoute,
      toggleGrid,
      toggleRanges,
      toggleSnap,
      nodesById,
      createShape,
      updateShape,
      deleteShape,
      selectShape,
      setAddShapeType,
    }),
    [
      state,
      refresh,
      addNode,
      updateNode,
      deleteNode,
      updateFactory,
      setInternet,
      computeRoute,
      select,
      setAddType,
      setRoute,
      toggleGrid,
      toggleRanges,
      toggleSnap,
      nodesById,
      createShape,
      updateShape,
      deleteShape,
      selectShape,
      setAddShapeType,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp debe usarse dentro de <AppProvider>");
  }
  return ctx;
}
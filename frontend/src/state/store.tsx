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
  NodeDto,
  NodePatch,
  NodeType,
  RouteDto,
  SimulationDto,
} from "../models/types";

export interface AppState {
  sim: SimulationDto | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  route: RouteDto | null;
  addType: NodeType | null;
  showGrid: boolean;
  showRanges: boolean;
}

const initialState: AppState = {
  sim: null,
  loading: true,
  error: null,
  selectedId: null,
  route: null,
  addType: null,
  showGrid: true,
  showRanges: true,
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
  nodesById: () => Map<string, NodeDto>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const sim = await api.getSimulation();
      setState((s) => ({ ...s, sim, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      }));
    }
  }, []);

  const runMutation = useCallback(
    async <T,>(action: () => Promise<T>): Promise<boolean> => {
      try {
        await action();
        await refresh();
        return true;
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : "Error desconocido",
        }));
        return false;
      }
    },
    [refresh],
  );

  const addNode = useCallback(
    (payload: NewNodePayload) =>
      runMutation(() => api.createNode(payload).then(() => undefined)),
    [runMutation],
  );

  const updateNode = useCallback(
    (id: string, patch: NodePatch) =>
      runMutation(() => api.updateNode(id, patch).then(() => undefined)),
    [runMutation],
  );

  const deleteNode = useCallback(
    (id: string) => runMutation(() => api.deleteNode(id)),
    [runMutation],
  );

  const updateFactory = useCallback(
    (patch: FactoryPatch) => runMutation(() => api.updateFactory(patch)),
    [runMutation],
  );

  const setInternet = useCallback(
    (available: boolean) => runMutation(() => api.setInternet(available)),
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
    setState((s) => ({ ...s, selectedId: id, addType: null }));
  }, []);

  const setAddType = useCallback((t: NodeType | null) => {
    setState((s) => ({ ...s, addType: t, selectedId: null }));
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
      nodesById,
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
      nodesById,
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
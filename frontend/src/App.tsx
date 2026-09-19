import { useEffect } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { FactoryCanvas } from "./components/FactoryCanvas";
import NodeFormPanel from "./components/NodeFormPanel";
import ShapeFormPanel from "./components/ShapeFormPanel";
import StatusBar from "./components/StatusBar";
import StatusPanel from "./components/StatusPanel";
import Toasts from "./components/Toasts";
import Toolbar from "./components/Toolbar";
import { useShortcuts } from "./hooks/useShortcuts";
import { AppProvider, useApp } from "./state/store";
import { UIProvider } from "./state/ui";

function Shell() {
  const { state, refresh } = useApp();
  useShortcuts();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="app">
      <Toolbar />
      {state.error && (
        <div className="banner banner-error" role="alert">
          <span>{state.error}</span>
          <button className="btn ghost" onClick={() => void refresh()}>Reintentar</button>
        </div>
      )}
      {state.loading && state.loadingOperation && (
        <div className="banner banner-loading" role="status">
          <span className="loading-spinner" />
          <span>{state.loadingOperation}...</span>
        </div>
      )}
      <div className="workspace">
        <div className="canvas-wrap">
          <FactoryCanvas />
        </div>
        <aside className="sidebar">
          <NodeFormPanel />
          <ShapeFormPanel />
          <StatusPanel />
        </aside>
      </div>
      <StatusBar />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <UIProvider>
          <Shell />
        </UIProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
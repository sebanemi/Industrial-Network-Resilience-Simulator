import { useEffect } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { FactoryCanvas } from "./components/FactoryCanvas";
import NodeFormPanel from "./components/NodeFormPanel";
import ShapeFormPanel from "./components/ShapeFormPanel";
import StatusPanel from "./components/StatusPanel";
import Toolbar from "./components/Toolbar";
import { AppProvider, useApp } from "./state/store";

function Shell() {
  const { state, refresh } = useApp();

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
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
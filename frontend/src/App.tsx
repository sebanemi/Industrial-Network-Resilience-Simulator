import { useEffect } from "react";

import { FactoryCanvas } from "./components/FactoryCanvas";
import { NodeFormPanel } from "./components/NodeFormPanel";
import { StatusPanel } from "./components/StatusPanel";
import { Toolbar } from "./components/Toolbar";
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
          {state.error}
        </div>
      )}
      <div className="workspace">
        <div className="canvas-wrap">
          <FactoryCanvas />
        </div>
        <aside className="sidebar">
          <NodeFormPanel />
          <StatusPanel />
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
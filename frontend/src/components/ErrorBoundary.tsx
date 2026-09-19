import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <div className="error-content">
            <h2>Algo salió mal</h2>
            <p className="error-message">
              {this.state.error?.message || "Se produjo un error inesperado"}
            </p>
            <button className="btn primary" onClick={this.handleReset}>
              Intentar nuevamente
            </button>
            <button className="btn ghost" onClick={() => window.location.reload()}>
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

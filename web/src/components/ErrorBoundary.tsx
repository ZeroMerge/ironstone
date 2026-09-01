import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
          <p className="text-lg font-bold">Something went wrong.</p>
          <button
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

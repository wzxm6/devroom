import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Last-resort catch for render crashes anywhere below it. Page-level error
// banners stay as-is; this only handles failures those cannot (e.g. a
// component throwing during render). Never surfaces internals to users.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error('Uncaught render error', {
      message: error.message,
      componentStack: info.componentStack?.slice(0, 2000),
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private handleHome = (): void => {
    window.location.href = '/dashboard';
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
          <div
            role="alert"
            className="w-full max-w-md rounded-lg border border-destructive/20 bg-card p-8 text-center space-y-4"
          >
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground">
                The page hit an unexpected error. Your data is safe — try again or return to the
                dashboard.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={this.handleRetry} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Try again
              </Button>
              <Button size="sm" onClick={this.handleHome} className="text-xs">
                <Home className="h-3 w-3 mr-1.5" />
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

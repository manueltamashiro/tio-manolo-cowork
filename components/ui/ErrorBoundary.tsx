"use client";

import { Component, ReactNode } from "react";

export interface ErrorBoundaryProps {
  /** Children to be wrapped by the error boundary */
  children: ReactNode;
  /** Fallback component to render when an error occurs */
  fallback?: ReactNode | ((error: Error, errorInfo: React.ErrorInfo) => ReactNode);
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<ErrorFallback error={error} resetError={() => window.location.reload()} />}
 *   onError={(error, errorInfo) => console.error(error)}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundaryInternal extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error Boundary caught an error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    }

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;

      if (this.props.fallback) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback(error!, errorInfo!)
          : this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={error!}
          errorInfo={errorInfo}
          resetError={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper component for using ErrorBoundary with simple props
 * This makes it easier to use from server components
 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundaryInternal
      onError={(error, errorInfo) => {
        console.error("Error Boundary caught an error:", error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundaryInternal>
  );
}

/**
 * Re-export the class component with a different name for advanced use cases
 */
export { ErrorBoundaryInternal as ErrorBoundaryClass };

/**
 * Default error fallback UI component
 */
export interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
}

export function DefaultErrorFallback({
  error,
  errorInfo,
  resetError,
}: DefaultErrorFallbackProps): ReactNode {
  const handleReload = (): void => {
    window.location.reload();
  };

  const handleReset = (): void => {
    resetError();
  };

  const handleCopyError = async (): Promise<void> => {
    const errorText = `Error: ${error.message}\n\nStack: ${error.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;
    try {
      await navigator.clipboard.writeText(errorText);
      alert("Error details copied to clipboard");
    } catch {
      console.error("Failed to copy error details");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <div className="max-w-2xl w-full bg-neutral-800 rounded-lg border border-neutral-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-700">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-neutral-300 mb-4">
            An unexpected error occurred. This has been logged and you can try to recover
            from this error.
          </p>

          {/* Error Message */}
          {error.message && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-neutral-400 mb-2">Error Message</h2>
              <div className="bg-neutral-900 rounded-md p-3 border border-neutral-700">
                <code className="text-sm text-red-400 break-words">{error.message}</code>
              </div>
            </div>
          )}

          {/* Stack Trace - shown in development only */}
          {process.env.NODE_ENV === "development" && error.stack && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-neutral-400 hover:text-neutral-300 mb-2">
                Stack Trace
              </summary>
              <div className="bg-neutral-900 rounded-md p-3 border border-neutral-700 max-h-40 overflow-auto">
                <pre className="text-xs text-neutral-400 whitespace-pre-wrap break-words font-mono">
                  {error.stack}
                </pre>
              </div>
            </details>
          )}

          {/* Component Stack - shown in development only */}
          {process.env.NODE_ENV === "development" && errorInfo?.componentStack && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-neutral-400 hover:text-neutral-300 mb-2">
                Component Stack
              </summary>
              <div className="bg-neutral-900 rounded-md p-3 border border-neutral-700 max-h-40 overflow-auto">
                <pre className="text-xs text-neutral-400 whitespace-pre-wrap break-words font-mono">
                  {errorInfo.componentStack}
                </pre>
              </div>
            </details>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-neutral-700">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Try Again
          </button>
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-neutral-700 text-white rounded-md hover:bg-neutral-600 transition-colors font-medium text-sm"
          >
            Reload Page
          </button>
          <button
            onClick={handleCopyError}
            className="px-4 py-2 bg-neutral-700 text-neutral-300 rounded-md hover:bg-neutral-600 transition-colors font-medium text-sm ml-auto"
          >
            Copy Error Details
          </button>
        </div>
      </div>
    </div>
  );
}

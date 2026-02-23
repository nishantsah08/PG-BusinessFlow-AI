import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

/**
 * Global Error Boundary to catch React rendering crashes.
 * Adheres to rule 5: UI must display failures immediately.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    resetBoundary = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        // Optional: window.location.reload() for a hard reset
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
                    <div className="max-w-xl w-full bg-white p-8 rounded-xl shadow-lg border border-red-100 flex flex-col items-center text-center space-y-6">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h1>
                            <p className="text-gray-600">
                                The interface encountered an unexpected failure.
                            </p>
                        </div>

                        {/* Debuggable UI Rule 6 */}
                        <div className="w-full bg-gray-900 rounded-lg p-4 text-left overflow-hidden">
                            <p className="text-red-400 font-mono text-sm break-words">
                                {this.state.error && this.state.error.toString()}
                            </p>
                            {this.state.errorInfo && (
                                <details className="mt-2 text-gray-400 text-xs font-mono">
                                    <summary className="cursor-pointer hover:text-gray-300">Component Stack</summary>
                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </details>
                            )}
                        </div>

                        <button
                            onClick={this.resetBoundary}
                            className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                        >
                            <RefreshCcw className="w-5 h-5" />
                            <span>Attempt Recovery</span>
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

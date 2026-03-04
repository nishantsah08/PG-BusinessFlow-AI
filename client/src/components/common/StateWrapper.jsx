import React from 'react';
import { Loader2, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

/**
 * StateWrapper component enforces the mandatory 5 UI states:
 * 1. loading
 * 2. success
 * 3. empty
 * 4. error
 * 5. retry
 * 
 * Props:
 * - state: 'loading' | 'success' | 'empty' | 'error'
 * - error: string | null (Error message to display)
 * - onRetry: function (Callback for the retry action)
 * - emptyMessage: string (Custom message for empty state)
 * - children: React.ReactNode (The content to render on 'success')
 */
const StateWrapper = ({
    state,
    error,
    onRetry,
    emptyMessage = "No data available.",
    children
}) => {

    if (state === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-indigo-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium">Loading...</p>
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-red-600 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm font-medium text-center">{error || 'An unexpected error occurred.'}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors text-sm font-medium mt-4"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Retry</span>
                    </button>
                )}
            </div>
        );
    }

    if (state === 'empty') {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                <Inbox className="w-8 h-8 text-gray-400" />
                <p className="text-sm">{emptyMessage}</p>
                {/* Sometimes an empty state can also have a retry or refresh action */}
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-md transition-colors text-sm font-medium mt-4"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Refresh</span>
                    </button>
                )}
            </div>
        );
    }

    if (state === 'success') {
        return <>{children}</>;
    }

    // Fallback if state is somehow invalid
    return (
        <div className="p-4 text-red-500 border border-red-200 bg-red-50 rounded">
            Invalid component state provided to StateWrapper.
        </div>
    );
};

export default StateWrapper;

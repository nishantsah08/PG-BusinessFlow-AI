import React from 'react';
import { ArrowRight, CheckCircle2, XCircle, Clock, Hash } from 'lucide-react';

/**
 * Shared RequestLogItem Component
 * Satisfies transparent UI constraint: must display correlation id, execution time, request status, and endpoint called.
 * Type definitions:
 * @typedef {Object} RequestLogItemProps
 * @property {string} correlationId - Unique trace ID
 * @property {number} latencyMs - Execution time
 * @property {boolean} success - Request status
 * @property {string} endpoint - Endpoint called (e.g., POST /api/master_ai/chat)
 * @property {string} [errorMessage] - Optional error details
 */
const RequestLogItem = ({
    correlationId,
    latencyMs,
    success,
    endpoint,
    errorMessage
}) => {
    return (
        <div className={`p-3 rounded-lg border text-sm flex flex-col space-y-2 transition-colors ${success ? 'bg-white border-green-100' : 'bg-red-50 border-red-200'
            }`}>
            {/* Header: Status and Endpoint */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-mono text-xs">
                    {success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-semibold text-gray-700 flex items-center">
                        <ArrowRight className="w-3 h-3 text-gray-400 mr-1" />
                        {endpoint}
                    </span>
                </div>

                {/* Execution Time */}
                <div className="flex items-center text-gray-500 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3 mr-1" />
                    {latencyMs}ms
                </div>
            </div>

            {/* Error Message (if any) */}
            {!success && errorMessage && (
                <div className="text-red-600 text-xs bg-red-100/50 p-2 rounded border border-red-100 font-mono overflow-x-auto">
                    {errorMessage}
                </div>
            )}

            {/* Correlation ID */}
            <div className="flex items-center text-gray-400 font-mono text-[10px] mt-1">
                <Hash className="w-3 h-3 mr-1 opacity-50" />
                Trace ID: {correlationId}
            </div>
        </div>
    );
};

export default RequestLogItem;

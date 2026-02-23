import React from 'react';
import { useUI } from '../../context/UIContext';
import { Loader2 } from 'lucide-react';

const GlobalLoader = () => {
    const { isLoading } = useUI();

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
            <div className="flex flex-col items-center p-6 bg-white rounded-xl shadow-2xl">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <p className="text-gray-700 font-medium">Processing request...</p>
                <p className="text-gray-400 text-sm mt-1">Please wait</p>
            </div>
        </div>
    );
};

export default GlobalLoader;

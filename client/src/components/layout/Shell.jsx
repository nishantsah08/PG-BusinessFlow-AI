import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Shell = () => {
    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans">
            <Sidebar />
            <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-white shadow-sm md:rounded-l-2xl md:my-2 md:-ml-4 border-y border-l border-gray-200 z-20">
                <Outlet />
            </main>
        </div>
    );
};

export default Shell;

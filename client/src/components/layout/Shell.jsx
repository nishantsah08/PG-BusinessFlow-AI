import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Shell = () => {
    return (
        <div className="flex flex-col h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans">
            <TopBar />
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar />
                <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-white shadow-md md:rounded-tl-2xl border-t border-l border-gray-200 z-20">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Shell;

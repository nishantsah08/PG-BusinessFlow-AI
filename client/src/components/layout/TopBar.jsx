import React from 'react';
import { Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TopBar = () => {
    const { logout } = useAuth();

    return (
        <header className="w-full h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30 shrink-0 shadow-sm relative">
            {/* Branding on the left */}
            <div className="flex items-center space-x-3">
                <div className="w-9 h-9 shadow-inner rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
                    <span className="text-white font-extrabold text-sm tracking-widest">PG</span>
                </div>
                <span className="font-bold text-xl text-gray-900 tracking-tight">
                    pgbusinessflow<span className="text-indigo-600 font-extrabold">.ai</span>
                </span>
            </div>

            {/* Actions on the right */}
            <div className="flex items-center space-x-6">
                <button className="flex items-center text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all">
                    <Settings className="w-5 h-5 md:mr-2" />
                    <span className="text-sm font-semibold hidden md:block">Settings</span>
                </button>
                <div className="w-px h-6 bg-gray-200 hidden md:block"></div>
                <button
                    onClick={logout}
                    className="flex items-center text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-all"
                >
                    <LogOut className="w-5 h-5 md:mr-2" />
                    <span className="text-sm font-semibold hidden md:block">Logout</span>
                </button>
            </div>
        </header>
    );
};

export default TopBar;

import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, Code, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDeveloperMode } from '../../context/DeveloperModeContext';
import SettingsDropdown from '../settings/SettingsDropdown';

const TopBar = () => {
    const { user, logout } = useAuth();
    const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            <div className="flex items-center space-x-4 md:space-x-6">
                {/* User Profile Info */}
                {user && (
                    <div className="flex items-center space-x-3 pr-2 border-r border-gray-200">
                        <div className="flex flex-col items-end hidden md:flex">
                            <span className="text-sm font-semibold text-gray-800">{user.name || 'Admin User'}</span>
                            <span className="text-xs text-gray-400 font-medium">{user.email || 'admin@pgbusinessflow.ai'}</span>
                        </div>
                        {user.picture ? (
                            <img src={user.picture} alt="Avatar" className="w-9 h-9 rounded-full shadow-sm border border-gray-200 object-cover" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                <User className="w-5 h-5 text-indigo-400" />
                            </div>
                        )}
                    </div>
                )}

                {/* Settings Dropdown Container */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`flex items-center px-3 py-2 rounded-lg transition-all ${isSettingsOpen ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    >
                        <Settings className="w-5 h-5 md:mr-2" />
                        <span className="text-sm font-semibold hidden md:block">Settings</span>
                    </button>

                    <SettingsDropdown
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                    />
                </div>
            </div>
        </header>
    );
};

export default TopBar;

import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquareCode, Activity, FolderKanban } from 'lucide-react';
import { useDeveloperMode } from '../../context/DeveloperModeContext';

const Sidebar = () => {
    const { isDeveloperMode } = useDeveloperMode();

    const navItems = [
        { path: '/master', icon: MessageSquareCode, label: 'Master AI' },
        // { path: '/dashboard', icon: LayoutGrid, label: 'Agent Dashboard' } // This item will be conditionally rendered
    ];

    return (
        <aside className="w-16 md:w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10 shrink-0">

            <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 hidden md:block px-3">
                    Systems
                </div>
                {navItems.map(({ path, icon: Icon, label }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) =>
                            `w - full flex items - center p - 3 rounded - xl transition - all duration - 200 group ${isActive
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            } `
                        }
                    >
                        <Icon className="w-6 h-6 flex-shrink-0" />
                        <span className="ml-3 hidden md:block">{label}</span>
                    </NavLink>
                ))}

                {/* Agent Dashboard - Developer Mode Only */}
                {isDeveloperMode && (
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) =>
                            `w - full flex items - center p - 3 rounded - xl transition - all duration - 200 group ${isActive
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            } `
                        }
                    >
                        <Activity className="w-6 h-6 flex-shrink-0" />
                        <span className="ml-3 hidden md:block">Agent Dashboard</span>
                    </NavLink>
                )}
            </nav>

            {/* System Status Indicator - Architecture Rule 4/6 reminder */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex items-center space-x-2 px-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-gray-500 hidden md:block">System Online</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;

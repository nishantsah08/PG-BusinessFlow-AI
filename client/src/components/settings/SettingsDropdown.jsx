import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Monitor } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useDeveloperMode } from '../../context/DeveloperModeContext';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';
import { isProductionApp } from '../../lib/runtimeEnv';

const SettingsDropdown = ({ isOpen, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const { logout } = useAuth();
    const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();
    const isProd = isProductionApp();
    const [expandedGroups, setExpandedGroups] = useState(['time']);

    if (!isOpen) return null;

    const toggleGroup = (group) => {
        setExpandedGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    const timezones = [
        { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST) (GMT+05:30)' },
        { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST) (GMT+09:00)' },
        { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT) (GMT+08:00)' },
        { value: 'Asia/Dubai', label: 'Asia/Dubai (GST) (GMT+04:00)' },
        { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
        { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST) (GMT+01/02)' },
        { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST) (GMT+01/02)' },
        { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST) (GMT+01/02)' },
        { value: 'America/New_York', label: 'America/New_York (EST/EDT) (GMT-05/04)' },
        { value: 'America/Chicago', label: 'America/Chicago (CST/CDT) (GMT-06/05)' },
        { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT) (GMT-08/07)' },
        { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT) (GMT-03:00)' },
        { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT) (GMT+10/11)' },
        { value: 'Australia/Perth', label: 'Australia/Perth (AWST) (GMT+08:00)' },
        { value: 'Africa/Cairo', label: 'Africa/Cairo (EET) (GMT+02:00)' },
        { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST) (GMT+02:00)' },
        { value: 'UTC', label: 'UTC (GMT)' }
    ];

    const dateFormats = [
        'DD-MM-YYYY',
        'MM-DD-YYYY',
        'YYYY-MM-DD',
        'DD/MM/YYYY'
    ];

    return (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-2 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-900">Application Settings</h3>
            </div>

            <div className="p-2 space-y-1">
                {/* Time & Date Group */}
                <div className="rounded-xl overflow-hidden">
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleGroup('time'); }}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg"
                    >
                        <div className="flex items-center space-x-3">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            <span className="text-sm font-semibold text-gray-700">Time & Date</span>
                        </div>
                        {expandedGroups.includes('time') ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </button>

                    {expandedGroups.includes('time') && (
                        <div className="px-3 py-2 space-y-3 bg-gray-50/50 rounded-lg mt-1 mx-1">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Time Zone</label>
                                <select
                                    value={settings.timezone}
                                    onChange={(e) => updateSettings({ timezone: e.target.value })}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full bg-white border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none"
                                >
                                    {timezones.map(tz => (
                                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Date Format</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {dateFormats.map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={(e) => { e.stopPropagation(); updateSettings({ date_format: fmt }); }}
                                            className={`text-[11px] py-1.5 px-2 rounded-md border transition-all ${settings.date_format === fmt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-300'}`}
                                        >
                                            {fmt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Time Format</label>
                                <div className="flex bg-gray-200/50 p-1 rounded-lg">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateSettings({ time_format: '12h' }); }}
                                        className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all ${settings.time_format === '12h' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        12h (1:30 PM)
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateSettings({ time_format: '24h' }); }}
                                        className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all ${settings.time_format === '24h' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        24h (13:30)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* System Group */}
                {!isProd && (
                    <div className="rounded-xl overflow-hidden border-t border-gray-50 pt-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleGroup('system'); }}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg"
                    >
                        <div className="flex items-center space-x-3">
                            <Monitor className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-semibold text-gray-700">System</span>
                        </div>
                        {expandedGroups.includes('system') ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </button>

                    {expandedGroups.includes('system') && (
                        <div className="px-3 py-2 space-y-2 bg-gray-50/50 rounded-lg mt-1 mx-1">
                            <div className="flex items-center justify-between p-1">
                                <div>
                                    <p className="text-xs font-semibold text-gray-700">Developer Mode</p>
                                    <p className="text-[10px] text-gray-400">Advanced tools</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleDeveloperMode(); }}
                                    className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors duration-200 ${isDeveloperMode ? 'bg-indigo-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${isDeveloperMode ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Logout Footer */}
            <div className="mt-2 p-2 border-t border-gray-50">
                <button
                    onClick={logout}
                    className="w-full flex items-center text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-all text-sm font-medium"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out securely
                </button>
            </div>
        </div>
    );
};

export default SettingsDropdown;

import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Globe, Calendar, Clock, Monitor } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useDeveloperMode } from '../../context/DeveloperModeContext';

const SettingsModal = ({ isOpen, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();
    const [expandedGroups, setExpandedGroups] = useState(['time']);

    if (!isOpen) return null;

    const toggleGroup = (group) => {
        setExpandedGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    const timezones = [
        { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST) (GMT+05:30)' },
        { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
        { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
        { value: 'UTC', label: 'UTC (Greenwich Mean Time)' }
    ];

    const dateFormats = [
        'DD-MM-YYYY',
        'MM-DD-YYYY',
        'YYYY-MM-DD',
        'DD/MM/YYYY'
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Time & Date Group */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <button
                            onClick={() => toggleGroup('time')}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-gray-800">Time & Date</span>
                            </div>
                            {expandedGroups.includes('time') ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        </button>

                        {expandedGroups.includes('time') && (
                            <div className="p-4 bg-gray-50/30 border-t border-gray-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Time Zone</label>
                                    <select
                                        value={settings.timezone}
                                        onChange={(e) => updateSettings({ timezone: e.target.value })}
                                        className="w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
                                    >
                                        {timezones.map(tz => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Date Format</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {dateFormats.map(fmt => (
                                            <label key={fmt} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${settings.date_format === fmt ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100' : 'bg-white border-gray-100 hover:border-indigo-100'}`}>
                                                <input
                                                    type="radio"
                                                    className="hidden"
                                                    checked={settings.date_format === fmt}
                                                    onChange={() => updateSettings({ date_format: fmt })}
                                                />
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${settings.date_format === fmt ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                                                    {settings.date_format === fmt && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                                <span className={`text-sm font-medium ${settings.date_format === fmt ? 'text-indigo-700' : 'text-gray-600'}`}>{fmt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Time Presentation</label>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => updateSettings({ time_format: '12h' })}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${settings.time_format === '12h' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            12-hour (1:30 PM)
                                        </button>
                                        <button
                                            onClick={() => updateSettings({ time_format: '24h' })}
                                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${settings.time_format === '24h' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            24-hour (13:30)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* System Group */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <button
                            onClick={() => toggleGroup('system')}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
                                    <Monitor className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-gray-800">System Preferences</span>
                            </div>
                            {expandedGroups.includes('system') ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        </button>

                        {expandedGroups.includes('system') && (
                            <div className="p-4 bg-gray-50/30 border-t border-gray-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between p-2">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700">Developer Mode</p>
                                        <p className="text-xs text-gray-400">Enables advanced technical tools</p>
                                    </div>
                                    <button
                                        onClick={toggleDeveloperMode}
                                        className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors duration-200 ${isDeveloperMode ? 'bg-indigo-500' : 'bg-gray-200'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${isDeveloperMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

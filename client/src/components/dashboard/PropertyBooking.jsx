import React, { useState } from 'react';
import PropertyManagementView from './property/PropertyManagementView';
import BookingOverviewView from './property/BookingOverviewView';
import MaintenanceView from './property/MaintenanceView';
import MetersView from './property/MetersView';

const PropertyBooking = () => {
    const [activeTab, setActiveTab] = useState('management');

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Property & Booking</h1>
                        <p className="text-sm text-gray-500 font-medium tracking-wide">Manage assets, occupancy, and maintenance</p>
                    </div>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="bg-white border-b border-gray-200 px-6 shrink-0">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('management')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'management'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Property Management
                    </button>
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Booking Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('meters')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'meters'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Electric Meters
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'maintenance'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Maintenance
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'management' && (
                    <PropertyManagementView />
                )}
                {activeTab === 'overview' && (
                    <BookingOverviewView />
                )}
                {activeTab === 'meters' && (
                    <MetersView />
                )}
                {activeTab === 'maintenance' && (
                    <MaintenanceView />
                )}
            </div>
        </div>
    );
};

export default PropertyBooking;

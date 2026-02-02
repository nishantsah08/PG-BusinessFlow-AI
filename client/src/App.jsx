import React, { useState } from 'react';
import { MessageSquare, LayoutGrid } from 'lucide-react';
import MasterAITab from './components/MasterAITab';
import DeveloperTab from './components/DeveloperTab';

function App() {
    const [activeTab, setActiveTab] = useState('master'); // 'master' or 'developer'

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900">
            {/* Sidebar */}
            <div className="w-16 md:w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100 font-bold text-xl text-indigo-600 hidden md:block">
                    Kalyani
                </div>
                <nav className="flex-1 p-2 space-y-2">
                    <button
                        onClick={() => setActiveTab('master')}
                        className={`w-full flex items-center p-2 rounded-lg transition-colors ${activeTab === 'master' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <MessageSquare className="w-6 h-6" />
                        <span className="ml-3 hidden md:block font-medium">Master AI</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('developer')}
                        className={`w-full flex items-center p-2 rounded-lg transition-colors ${activeTab === 'developer' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <LayoutGrid className="w-6 h-6" />
                        <span className="ml-3 hidden md:block font-medium">Developer</span>
                    </button>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'master' ? <MasterAITab /> : <DeveloperTab />}
            </div>
        </div>
    );
}

export default App;

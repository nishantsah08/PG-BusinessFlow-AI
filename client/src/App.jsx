import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UIProvider } from './context/UIContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import GlobalLoader from './components/common/GlobalLoader';
import NotificationSystem from './components/common/NotificationSystem';
import Shell from './components/layout/Shell';

// Pages
import ControlPanel from './pages/ControlPanel';
import AgentDashboard from './components/dashboard/AgentDashboard';

// Placeholder Pages for routing
const Placeholder = ({ title }) => (
    <div className="p-8 h-full flex items-center justify-center text-gray-400 font-medium bg-gray-50 rounded-xl m-4 border-2 border-dashed border-gray-200">
        <div className="text-center">
            <h2 className="text-xl text-gray-600 mb-2">{title}</h2>
            <p className="text-sm">Phase Pending Construction</p>
        </div>
    </div>
);

function App() {
    return (
        <ErrorBoundary>
            <UIProvider>
                <BrowserRouter>
                    <GlobalLoader />
                    <NotificationSystem />

                    <Routes>
                        <Route path="/" element={<Shell />}>
                            {/* Redirect root to Control Panel initially */}
                            <Route index element={<Navigate to="/master" replace />} />

                            {/* Phase 2: Control Panel */}
                            <Route path="master" element={<ControlPanel />} />

                            {/* Phase 3: Agent Dashboard */}
                            <Route path="dashboard" element={<AgentDashboard />} />

                            {/* Phase 4: Workflow Monitor */}
                            <Route path="monitor" element={<Placeholder title="Workflow Monitor" />} />

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </UIProvider>
        </ErrorBoundary>
    );
}

export default App;

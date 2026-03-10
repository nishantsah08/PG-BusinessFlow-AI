import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { UIProvider } from './context/UIContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DeveloperModeProvider } from './context/DeveloperModeContext';
import { SettingsProvider } from './context/SettingsContext';
import { ChatProvider } from './context/ChatContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import GlobalLoader from './components/common/GlobalLoader';
import NotificationSystem from './components/common/NotificationSystem';
import Shell from './components/layout/Shell';
import { getViteEnv } from './lib/runtimeEnv';

// Pages
import ControlPanel from './pages/ControlPanel';
import AgentDashboard from './components/dashboard/AgentDashboard';
import PropertyBooking from './components/dashboard/PropertyBooking';
import CRMConsole from './components/dashboard/CRMConsole';
import LoginPage from './pages/LoginPage';
import HRPage from './pages/HRPage';
import FinancePage from './pages/FinancePage';

// Placeholder Pages for routing
const Placeholder = ({ title }) => (
    <div className="p-8 h-full flex items-center justify-center text-gray-400 font-medium bg-gray-50 rounded-xl m-4 border-2 border-dashed border-gray-200">
        <div className="text-center">
            <h2 className="text-xl text-gray-600 mb-2">{title}</h2>
            <p className="text-sm">Phase Pending Construction</p>
        </div>
    </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

function App() {
    // Use a placeholder Google Client ID for non-production local boot.
    const GOOGLE_CLIENT_ID = getViteEnv('VITE_GOOGLE_CLIENT_ID', "739328227651-placeholder.apps.googleusercontent.com");

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AuthProvider>
                <SettingsProvider>
                    <DeveloperModeProvider>
                        <ChatProvider>
                            <ErrorBoundary>
                                <UIProvider>
                                    <BrowserRouter>
                                        <GlobalLoader />
                                        <NotificationSystem />

                                        <Routes>
                                            {/* Public Login Route */}
                                            <Route path="/login" element={<LoginPage />} />

                                            {/* Protected Application Routes */}
                                            <Route path="/" element={
                                                <ProtectedRoute>
                                                    <Shell />
                                                </ProtectedRoute>
                                            }>
                                                {/* Redirect root to Control Panel initially */}
                                                <Route index element={<Navigate to="/master" replace />} />

                                                {/* Phase 2: Control Panel */}
                                                <Route path="master" element={<ControlPanel />} />

                                                {/* Property & Booking */}
                                                <Route path="property" element={<PropertyBooking />} />

                                                {/* HR */}
                                                <Route path="hr" element={<HRPage />} />

                                                {/* Finance */}
                                                <Route path="finance" element={<FinancePage />} />

                                                {/* CRM */}
                                                <Route path="crm" element={<CRMConsole />} />

                                                {/* Phase 3: Agent Dashboard */}
                                                <Route path="dashboard" element={<AgentDashboard />} />

                                                <Route path="*" element={<Navigate to="/" replace />} />
                                            </Route>
                                        </Routes>
                                    </BrowserRouter>
                                </UIProvider>
                            </ErrorBoundary>
                        </ChatProvider>
                    </DeveloperModeProvider>
                </SettingsProvider>
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}

export default App;

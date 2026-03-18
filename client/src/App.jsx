import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UIProvider } from './context/UIContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DeveloperModeProvider } from './context/DeveloperModeContext';
import { SettingsProvider } from './context/SettingsContext';
import { ChatProvider } from './context/ChatContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import GlobalLoader from './components/common/GlobalLoader';
import NotificationSystem from './components/common/NotificationSystem';
import Shell from './components/layout/Shell';

// Pages
import ControlPanel from './pages/ControlPanel';
import AgentDashboard from './components/dashboard/AgentDashboard';
import PropertyBooking from './components/dashboard/PropertyBooking';
import CRMConsole from './components/dashboard/CRMConsole';
import LoginPage from './pages/LoginPage';
import ProductPage from './pages/ProductPage';
import HRPage from './pages/HRPage';
import FinancePage from './pages/FinancePage';
import CeoPhoneVerificationPage from './pages/CeoPhoneVerificationPage';
import WorkflowStudioPage from './pages/WorkflowStudioPage';

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
const ProtectedRoute = ({ children, allowPending = false }) => {
    const { user, authContext, authContextLoading } = useAuth();
    const location = useLocation();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    if (authContextLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-5 text-sm">Loading workspace access...</div>
            </div>
        );
    }
    if (!authContext) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    const requiresVerification = Boolean(authContext?.requires_ceo_phone_verification);
    if (!allowPending && requiresVerification) {
        return <Navigate to="/activate-ceo" replace state={{ from: location }} />;
    }
    if (allowPending && !requiresVerification) {
        return <Navigate to="/app/master" replace />;
    }
    return children;
};

function App() {
    return (
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
                                        <Route path="/" element={<ProductPage />} />
                                        <Route path="/product" element={<Navigate to="/" replace />} />
                                        <Route path="/login" element={<LoginPage />} />
                                        <Route
                                            path="/activate-ceo"
                                            element={(
                                                <ProtectedRoute allowPending>
                                                    <CeoPhoneVerificationPage />
                                                </ProtectedRoute>
                                            )}
                                        />

                                        {/* Protected Application Routes */}
                                        <Route path="/app" element={
                                            <ProtectedRoute>
                                                <Shell />
                                            </ProtectedRoute>
                                        }>
                                            {/* Redirect root to Control Panel initially */}
                                            <Route index element={<Navigate to="/app/master" replace />} />
                                            <Route path="overview" element={<Navigate to="/app/master" replace />} />

                                            {/* Phase 2: Control Panel */}
                                            <Route path="master" element={<ControlPanel />} />

                                            {/* Property & Booking */}
                                            <Route path="property" element={<PropertyBooking />} />

                                            {/* HR */}
                                            <Route path="hr" element={<HRPage />} />

                                            {/* Finance */}
                                            <Route path="finance" element={<FinancePage />} />

                                            {/* Workflows */}
                                            <Route path="workflows" element={<WorkflowStudioPage />} />

                                            {/* CRM */}
                                            <Route path="crm" element={<CRMConsole />} />

                                            {/* Phase 3: Agent Dashboard */}
                                            <Route path="dashboard" element={<AgentDashboard />} />

                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Route>

                                        <Route path="/master" element={<Navigate to="/app/master" replace />} />
                                        <Route path="/overview" element={<Navigate to="/app/master" replace />} />
                                        <Route path="/property" element={<Navigate to="/app/property" replace />} />
                                        <Route path="/hr" element={<Navigate to="/app/hr" replace />} />
                                        <Route path="/finance" element={<Navigate to="/app/finance" replace />} />
                                        <Route path="/workflows" element={<Navigate to="/app/workflows" replace />} />
                                        <Route path="/crm" element={<Navigate to="/app/crm" replace />} />
                                        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Routes>
                                </BrowserRouter>
                            </UIProvider>
                        </ErrorBoundary>
                    </ChatProvider>
                </DeveloperModeProvider>
            </SettingsProvider>
        </AuthProvider>
    );
}

export default App;

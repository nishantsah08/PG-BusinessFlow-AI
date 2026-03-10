import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Bot, AlertTriangle, Building2, Sparkles } from 'lucide-react';
import { apiClient } from '../api/client';
import { isProductionApp } from '../lib/runtimeEnv';

const LoginPage = () => {
    const { login, logout } = useAuth();
    const navigate = useNavigate();
    const isProd = isProductionApp();
    const [devEmail, setDevEmail] = useState('nishantsah@outlook.in');
    const [showDev, setShowDev] = useState(false);
    const [authError, setAuthError] = useState('');

    const completeGoogleAuth = async (credentialResponse, intent) => {
        const decoded = jwtDecode(credentialResponse.credential);
        setAuthError('');

        const interimUser = {
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture,
            idToken: credentialResponse.credential,
            type: 'Google'
        };
        login(interimUser);

        const bootstrap = await apiClient.post('/api/auth/bootstrap', {
            intent,
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture || null
        });

        if (!bootstrap.success) {
            logout();
            setAuthError(bootstrap.error || `Unable to ${intent}.`);
            return;
        }

        const payload = bootstrap.data || {};
        login({
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture,
            idToken: credentialResponse.credential,
            tenant_id: payload.tenant_id || 'default',
            tenantId: payload.tenant_id || 'default',
            profile_type: payload.profile_type || 'Customer',
            type: 'Google'
        });
        navigate('/master');
    };

    const handleGoogleSuccess = (intent) => async (credentialResponse) => {
        await completeGoogleAuth(credentialResponse, intent);
    };

    const handleGoogleError = () => {
        setAuthError('Google authentication failed. Please retry.');
    };

    const handleBypass = async (e) => {
        e.preventDefault();
        if (!devEmail) return;
        setAuthError('');

        const bootstrap = await apiClient.post('/api/auth/bootstrap', {
            intent: 'signin',
            email: devEmail,
            name: 'Dev Bypass User',
            picture: null
        });

        if (!bootstrap.success) {
            setAuthError(bootstrap.error || 'Developer bypass bootstrap failed.');
            return;
        }

        const payload = bootstrap.data || {};
        login({
            email: devEmail,
            name: payload.name || 'Dev Bypass User',
            picture: null,
            tenant_id: payload.tenant_id || 'default',
            tenantId: payload.tenant_id || 'default',
            profile_type: payload.profile_type || 'Customer',
            type: 'Bypass'
        });
        navigate('/master');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-slate-100 overflow-hidden relative">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-36 -left-20 w-96 h-96 rounded-full bg-cyan-400/15 blur-3xl" />
                <div className="absolute top-32 right-8 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 w-96 h-72 rounded-full bg-indigo-500/20 blur-3xl" />
            </div>

            <div className="relative min-h-screen w-full max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-2 gap-10 items-center">
                <section className="space-y-7">
                    <div className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-cyan-200/90 border border-cyan-300/30 rounded-full px-4 py-2 bg-slate-900/40 backdrop-blur-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        business operating system
                    </div>

                    <div className="space-y-4">
                        <h1
                            className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight text-white"
                            style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif' }}
                        >
                            PG-BusinessFlow.ai
                        </h1>
                        <p className="text-base sm:text-lg text-cyan-50/90 max-w-xl">
                            One control surface for sales, tenant onboarding, property operations, payroll, and finance workflows.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 max-w-xl">
                        <div className="rounded-xl bg-slate-900/45 border border-cyan-100/20 px-4 py-3">
                            <p className="text-xs text-cyan-100/70">Modules</p>
                            <p className="text-lg font-semibold text-cyan-50">5 Domains</p>
                        </div>
                        <div className="rounded-xl bg-slate-900/45 border border-cyan-100/20 px-4 py-3">
                            <p className="text-xs text-cyan-100/70">Launch</p>
                            <p className="text-lg font-semibold text-cyan-50">Google Auth</p>
                        </div>
                        <div className="rounded-xl bg-slate-900/45 border border-cyan-100/20 px-4 py-3">
                            <p className="text-xs text-cyan-100/70">Leadership</p>
                            <p className="text-lg font-semibold text-cyan-50">Auto CEO Setup</p>
                        </div>
                    </div>
                </section>

                <section className="w-full max-w-md justify-self-center">
                    <div className="rounded-2xl border border-cyan-100/20 bg-slate-950/60 backdrop-blur-xl shadow-2xl shadow-cyan-900/30 overflow-hidden">
                        <div className="px-7 py-6 border-b border-cyan-100/15">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-4">
                                <Building2 className="w-6 h-6 text-slate-950" />
                            </div>
                            <h2 className="text-2xl font-semibold text-white" style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif' }}>
                                Enter your workspace
                            </h2>
                            <p className="text-sm text-cyan-100/80 mt-1">
                                Sign in to an existing company or sign up to create a new CEO workspace.
                            </p>
                        </div>

                        <div className="p-7 space-y-4">
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/80">Sign In</p>
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess('signin')}
                                    onError={handleGoogleError}
                                    theme="filled_blue"
                                    shape="pill"
                                    text="signin_with"
                                    width="320"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/80">Sign Up</p>
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess('signup')}
                                    onError={handleGoogleError}
                                    theme="outline"
                                    shape="pill"
                                    text="signup_with"
                                    width="320"
                                />
                            </div>

                            {authError && (
                                <div className="text-xs rounded-lg border border-rose-300/30 bg-rose-900/25 text-rose-100 px-3 py-2">
                                    {authError}
                                </div>
                            )}

                            {!isProd && (
                                <div className="pt-4">
                                    <div
                                        className="text-xs text-cyan-200/80 hover:text-cyan-100 cursor-pointer transition-colors"
                                        onClick={() => setShowDev(!showDev)}
                                    >
                                        Developer / Automated Agent Access
                                    </div>
                                </div>
                            )}

                            {!isProd && showDev && (
                                <form onSubmit={handleBypass} className="space-y-3 bg-amber-100/95 p-4 rounded-xl border border-amber-200 text-slate-900">
                                    <div className="flex items-start space-x-2 text-xs">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <p><strong>Dev Bypass Active.</strong> Use any mock email. Use <code className="bg-amber-200 px-1 rounded">nishantsah@outlook.in</code> for CEO access.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Simulated Email</label>
                                        <input
                                            type="email"
                                            value={devEmail}
                                            onChange={(e) => setDevEmail(e.target.value)}
                                            placeholder="agent@test.local"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex justify-center items-center space-x-2"
                                    >
                                        <Bot className="w-4 h-4" />
                                        <span>Inject Context & Bypass</span>
                                    </button>
                                </form>
                            )}

                            <div className="text-[11px] text-cyan-100/60 pt-1 flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Google identity is used for workspace-level authorization.
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default LoginPage;

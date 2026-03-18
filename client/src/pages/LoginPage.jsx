import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Bot, Building2, Shield } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { firebaseAuth } from '../lib/firebaseClient';
import { getViteEnv } from '../lib/runtimeEnv';

const LoginPage = () => {
    const { login, logout, refreshAuthContext } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const appEnv = getViteEnv('VITE_APP_ENV', 'development');
    const isLocalDevelopment = appEnv === 'development';
    const docsUrl = getViteEnv('VITE_DOCS_URL', 'https://docs.fir-bestpg-development-public.web.app/');
    const defaultIntent = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('intent') === 'signup' ? 'signup' : 'signin';
    }, [location.search]);
    const [devEmail, setDevEmail] = useState('nishantsah@outlook.in');
    const [showDev, setShowDev] = useState(false);
    const [authError, setAuthError] = useState('');

    const completeGoogleAuth = async (intent) => {
        setAuthError('');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        const result = await signInWithPopup(firebaseAuth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const googleProfile = result.user;
        const idToken = credential?.idToken;

        if (!idToken || !googleProfile?.email) {
            throw new Error('Unable to obtain a Google identity token.');
        }

        login({
            email: googleProfile.email,
            name: googleProfile.displayName || googleProfile.email,
            picture: googleProfile.photoURL || null,
            idToken,
            type: 'Google',
        });

        const bootstrap = await apiClient.post('/api/auth/bootstrap', {
            intent,
            email: googleProfile.email,
            name: googleProfile.displayName || googleProfile.email,
            picture: googleProfile.photoURL || null,
        });

        if (!bootstrap.success) {
            logout();
            setAuthError(bootstrap.error || `Unable to ${intent}.`);
            return;
        }

        const payload = bootstrap.data || {};
        login({
            email: googleProfile.email,
            name: googleProfile.displayName || googleProfile.email,
            picture: googleProfile.photoURL || null,
            idToken,
            tenant_id: payload.tenant_id || 'default',
            tenantId: payload.tenant_id || 'default',
            profile_type: payload.profile_type || 'Customer',
            type: 'Google',
        });
        await refreshAuthContext();
        navigate(payload.requires_ceo_phone_verification ? '/activate-ceo' : '/app/master');
    };

    const handleGoogleAuth = (intent) => async () => {
        try {
            await completeGoogleAuth(intent);
        } catch (error) {
            setAuthError(error?.message || 'Google authentication failed. Please retry.');
        }
    };

    const handleBypass = async (event) => {
        event.preventDefault();
        if (!devEmail) return;
        setAuthError('');

        const bootstrap = await apiClient.post('/api/auth/bootstrap', {
            intent: 'signin',
            email: devEmail,
            name: 'Dev Bypass User',
            picture: null,
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
            type: 'Bypass',
        });
        await refreshAuthContext();
        navigate(payload.requires_ceo_phone_verification ? '/activate-ceo' : '/app/master');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 px-6 py-8 text-slate-100">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
                <header className="flex flex-col gap-4 rounded-[2rem] border border-cyan-100/15 bg-slate-950/45 px-6 py-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                    <div className="inline-flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-900/40">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tracking-[0.22em] text-cyan-50">PG-BUSINESSFLOW.AI</p>
                            <p className="text-xs text-cyan-100/65">Workspace access</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-cyan-100/80">
                        <a
                            href={docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-cyan-100/20 bg-slate-900/45 px-4 py-2 transition hover:border-cyan-100/35 hover:text-cyan-50"
                        >
                            Docs
                        </a>
                        <Link
                            to="/"
                            className="rounded-full border border-cyan-100/20 bg-slate-900/45 px-4 py-2 transition hover:border-cyan-100/35 hover:text-cyan-50"
                        >
                            Back to product
                        </Link>
                    </div>
                </header>

                <main className="flex flex-1 items-center justify-center py-10">
                    <section className="w-full max-w-md rounded-[2rem] border border-cyan-100/15 bg-slate-950/55 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
                        <div className="border-b border-cyan-100/12 pb-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <h1
                                className="mt-5 text-3xl font-semibold text-white"
                                style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif' }}
                            >
                                Enter your workspace
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-cyan-100/75">
                                Use Google to sign in to an existing workspace or create a new one.
                            </p>
                        </div>

                        <div className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/75">
                                    {defaultIntent === 'signup' ? 'Create workspace' : 'Sign in'}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleGoogleAuth(defaultIntent)}
                                    className="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                                >
                                    {defaultIntent === 'signup' ? 'Continue with Google to create workspace' : 'Continue with Google'}
                                </button>
                            </div>

                            {defaultIntent !== 'signup' && (
                                <div className="space-y-2">
                                    <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/75">Create workspace</p>
                                    <button
                                        type="button"
                                        onClick={handleGoogleAuth('signup')}
                                        className="inline-flex w-full items-center justify-center rounded-full border border-cyan-100/20 bg-slate-900/45 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-100/35 hover:text-white"
                                    >
                                        Continue with Google to create workspace
                                    </button>
                                </div>
                            )}

                            {authError && (
                                <div className="rounded-xl border border-rose-300/25 bg-rose-950/30 px-4 py-3 text-xs text-rose-100">
                                    {authError}
                                </div>
                            )}

                            {isLocalDevelopment && (
                                <div className="pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowDev((value) => !value)}
                                        className="text-xs text-cyan-200/80 transition hover:text-cyan-100"
                                    >
                                        Developer / Automated Agent Access
                                    </button>
                                </div>
                            )}

                            {isLocalDevelopment && showDev && (
                                <form onSubmit={handleBypass} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-100/95 p-4 text-slate-900">
                                    <div className="flex items-start gap-2 text-xs">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <p><strong>Dev Bypass Active.</strong> Use any mock email. Use <code className="rounded bg-amber-200 px-1">nishantsah@outlook.in</code> for CEO access.</p>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">Simulated Email</label>
                                        <input
                                            type="email"
                                            value={devEmail}
                                            onChange={(event) => setDevEmail(event.target.value)}
                                            placeholder="agent@test.local"
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                                    >
                                        <Bot className="h-4 w-4" />
                                        Inject Context & Bypass
                                    </button>
                                </form>
                            )}

                            <div className="flex items-center gap-2 pt-2 text-[11px] text-cyan-100/60">
                                <Shield className="h-3 w-3" />
                                Google identity is used for workspace-level authorization.
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default LoginPage;

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, KeyRound, Smartphone, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

const maskPhone = (phone) => {
    const raw = String(phone || '').trim();
    if (!raw) return '';
    return raw.length <= 4 ? raw : `${raw.slice(0, 4)}••••${raw.slice(-2)}`;
};

const CeoPhoneVerificationPage = () => {
    const navigate = useNavigate();
    const { authContext, refreshAuthContext } = useAuth();
    const [phone, setPhone] = useState(authContext?.owner?.phone || '');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [expiresAt, setExpiresAt] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [devOtp, setDevOtp] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);

    const ownerName = authContext?.owner?.name || authContext?.email || 'Workspace Owner';
    const businessName = authContext?.business_name || 'Your workspace';
    const maskedPhone = useMemo(() => maskPhone(phone), [phone]);

    const handleSendOtp = async (event) => {
        event.preventDefault();
        setSending(true);
        setError('');
        setNotice('');
        setDevOtp('');
        const response = await apiClient.post('/api/auth/ceo-phone/start', { phone });
        setSending(false);
        if (!response.success) {
            setError(response.error || 'Unable to send OTP.');
            return;
        }
        setOtpSent(true);
        setExpiresAt(response.data?.expires_at || '');
        setNotice(`OTP sent to ${maskPhone(response.data?.phone || phone)}.`);
        setDevOtp(response.data?.dev_otp || '');
    };

    const handleVerifyOtp = async (event) => {
        event.preventDefault();
        setVerifying(true);
        setError('');
        const response = await apiClient.post('/api/auth/ceo-phone/verify', { otp });
        setVerifying(false);
        if (!response.success) {
            setError(response.error || 'Unable to verify OTP.');
            return;
        }
        await refreshAuthContext();
        navigate('/master', { replace: true });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
                <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                    <section className="space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                            <ShieldCheck className="h-4 w-4" />
                            Account Activation Required
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-4xl font-semibold leading-tight text-white">Verify the CEO phone before the workspace can go live.</h1>
                            <p className="max-w-2xl text-base text-slate-300">
                                {businessName} is provisioned, but activation is blocked until the owner phone is verified and bound to the CEO identity.
                            </p>
                        </div>
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                                    <Building2 className="h-7 w-7" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Owner identity</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-white">{ownerName}</h2>
                                    <p className="mt-1 text-sm text-slate-400">{authContext?.email || 'CEO email unavailable'}</p>
                                </div>
                            </div>
                            <div className="mt-6 grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Why blocked</p>
                                    <p className="mt-2 text-sm text-slate-200">WhatsApp and cross-system identity need a verified CEO phone.</p>
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">What happens next</p>
                                    <p className="mt-2 text-sm text-slate-200">The verified phone is bound to the CEO and synced into CRM.</p>
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Portal rule</p>
                                    <p className="mt-2 text-sm text-slate-200">No HR, CRM, Property, or Finance usage is allowed before completion.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[32px] border border-slate-800 bg-white p-8 text-slate-900 shadow-2xl shadow-cyan-950/20">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">CEO Phone Verification</p>
                                <h2 className="mt-2 text-3xl font-semibold text-slate-950">Complete activation</h2>
                            </div>
                            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                                <Smartphone className="h-6 w-6" />
                            </div>
                        </div>

                        <form className="mt-8 space-y-6" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700" htmlFor="ceo-phone">CEO phone</label>
                                <p className="mt-1 text-xs text-slate-500">Use the phone that will own WhatsApp and workspace approvals.</p>
                                <input
                                    id="ceo-phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    disabled={otpSent}
                                    placeholder="+91 90000 11111"
                                    className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-cyan-500"
                                />
                            </div>

                            {otpSent && (
                                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center gap-3 text-slate-700">
                                        <KeyRound className="h-5 w-5 text-cyan-700" />
                                        <div>
                                            <p className="text-sm font-semibold">OTP sent to {maskedPhone}</p>
                                            <p className="text-xs text-slate-500">{expiresAt ? `Expires at ${new Date(expiresAt).toLocaleString('en-IN')}` : 'Use the latest code sent to the phone.'}</p>
                                        </div>
                                    </div>
                                    <label className="block text-sm font-semibold text-slate-700" htmlFor="ceo-otp">Enter OTP</label>
                                    <input
                                        id="ceo-otp"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(event) => setOtp(event.target.value)}
                                        placeholder="6-digit OTP"
                                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-cyan-500"
                                    />
                                    {devOtp ? (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                            Local verification code: <span className="font-semibold">{devOtp}</span>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {notice ? (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>
                            ) : null}

                            {error ? (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
                            ) : null}

                            <div className="space-y-3">
                                {!otpSent ? (
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {sending ? 'Sending OTP...' : 'Send OTP'}
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="submit"
                                            disabled={verifying}
                                            className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
                                        >
                                            {verifying ? 'Verifying...' : 'Verify and Activate'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={sending}
                                            onClick={handleSendOtp}
                                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                                        >
                                            Resend OTP
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default CeoPhoneVerificationPage;

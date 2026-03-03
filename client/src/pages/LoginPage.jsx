import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Bot, AlertTriangle } from 'lucide-react';

const LoginPage = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const isProd = (import.meta.env.VITE_APP_ENV || 'development') === 'production';
    const [devEmail, setDevEmail] = useState('nishantsah@outlook.in');
    const [showDev, setShowDev] = useState(false);

    const handleGoogleSuccess = (credentialResponse) => {
        const decoded = jwtDecode(credentialResponse.credential);
        console.log('Google Login Success:', decoded);
        login({
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture,
            idToken: credentialResponse.credential,
            type: 'Google'
        });
        navigate('/master');
    };

    const handleGoogleError = () => {
        console.error('Login Failed');
    };

    const handleBypass = (e) => {
        e.preventDefault();
        if (!devEmail) return;
        login({
            email: devEmail,
            name: 'Dev Bypass User',
            picture: null,
            type: 'Bypass'
        });
        navigate('/master');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 text-center bg-indigo-600 text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">MasterAI Admin</h1>
                    <p className="text-indigo-100 text-sm">Secure Portal Access</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            useOneTap
                            theme="filled_blue"
                            shape="pill"
                        />
                    </div>

                    {!isProd && (
                        <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500 hover:text-indigo-600 cursor-pointer transition-colors"
                                onClick={() => setShowDev(!showDev)}>
                                Developer / Automated Agent Access
                            </span>
                        </div>
                        </div>
                    )}

                    {!isProd && showDev && (
                        <form onSubmit={handleBypass} className="space-y-4 bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 overflow-hidden animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-start space-x-2 text-yellow-800 text-xs mb-3">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p><strong>Dev Bypass Active.</strong> Provide a mock email to assume an identity. Use <code className="bg-yellow-100 px-1 rounded">nishantsah@outlook.in</code> for CEO access.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Simulated Email</label>
                                <input
                                    type="email"
                                    value={devEmail}
                                    onChange={(e) => setDevEmail(e.target.value)}
                                    placeholder="agent@test.local"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex justify-center items-center space-x-2"
                            >
                                <Bot className="w-4 h-4" />
                                <span>Inject Context & Bypass</span>
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;

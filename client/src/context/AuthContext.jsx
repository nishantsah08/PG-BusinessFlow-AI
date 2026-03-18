import React, { createContext, useContext, useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { apiClient } from '../api/client';
import { firebaseAuth } from '../lib/firebaseClient';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        // Load from local storage if exists
        const savedUser = localStorage.getItem('master_ai_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [authContext, setAuthContext] = useState(null);
    const [authContextLoading, setAuthContextLoading] = useState(() => Boolean(localStorage.getItem('master_ai_user')));

    const refreshAuthContext = async () => {
        if (!user) {
            setAuthContext(null);
            return null;
        }
        setAuthContextLoading(true);
        try {
            const response = await apiClient.get('/api/auth/context');
            if (response.success) {
                setAuthContext(response.data || null);
                return response.data || null;
            }
            setAuthContext(null);
            return null;
        } catch (_err) {
            setAuthContext(null);
            return null;
        } finally {
            setAuthContextLoading(false);
        }
    };

    const login = (userData) => {
        // Expected format: { email, name, picture, idToken?, type }
        setAuthContext(null);
        setAuthContextLoading(true);
        setUser(userData);
        localStorage.setItem('master_ai_user', JSON.stringify(userData));
    };

    const logout = async () => {
        try {
            await signOut(firebaseAuth);
        } catch (_error) {
            // Ignore provider logout failures and always clear local auth state.
        }
        setUser(null);
        setAuthContext(null);
        localStorage.removeItem('master_ai_user');
    };

    useEffect(() => {
        refreshAuthContext();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.email, user?.idToken, user?.type, user?.tenant_id, user?.tenantId, user?.profile_type]);

    return (
        <AuthContext.Provider value={{ user, authContext, authContextLoading, login, logout, refreshAuthContext }}>
            {children}
        </AuthContext.Provider>
    );
};

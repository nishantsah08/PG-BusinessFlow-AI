import React, { createContext, useContext, useState, useEffect } from 'react';
import { googleLogout } from '@react-oauth/google';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        // Load from local storage if exists
        const savedUser = localStorage.getItem('master_ai_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const login = (userData) => {
        // Expected format: { email: "...", name: "...", picture: "...", type: "Google|Bypass" }
        setUser(userData);
        localStorage.setItem('master_ai_user', JSON.stringify(userData));
    };

    const logout = () => {
        googleLogout();
        setUser(null);
        localStorage.removeItem('master_ai_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

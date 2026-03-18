import React, { createContext, useContext, useState, useEffect } from 'react';
import { isProductionApp } from '../lib/runtimeEnv';

const DeveloperModeContext = createContext({
    isDeveloperMode: true,
    toggleDeveloperMode: () => { }
});

export const useDeveloperMode = () => useContext(DeveloperModeContext);

export const DeveloperModeProvider = ({ children }) => {
    const isProd = isProductionApp();
    const [isDeveloperMode, setIsDeveloperMode] = useState(() => {
        if (isProd) return false;
        const saved = localStorage.getItem('pg_developer_mode');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const toggleDeveloperMode = () => {
        if (isProd) return;
        setIsDeveloperMode(prev => {
            const nextMode = !prev;
            localStorage.setItem('pg_developer_mode', JSON.stringify(nextMode));
            return nextMode;
        });
    };

    return (
        <DeveloperModeContext.Provider value={{ isDeveloperMode, toggleDeveloperMode }}>
            {children}
        </DeveloperModeContext.Provider>
    );
};

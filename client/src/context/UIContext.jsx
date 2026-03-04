import React, { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext(null);

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error("useUI must be used within a UIProvider");
    }
    return context;
};

export const UIProvider = ({ children }) => {
    // Global loader state (for blocking operations)
    const [isLoading, setIsLoading] = useState(false);

    // Notification system state
    const [notifications, setNotifications] = useState([]);

    const showLoader = useCallback(() => setIsLoading(true), []);
    const hideLoader = useCallback(() => setIsLoading(false), []);

    // type can be 'info', 'success', 'warning', 'error'
    const addNotification = useCallback((message, type = 'info', duration = 5000) => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeNotification(id);
            }, duration);
        }
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <UIContext.Provider
            value={{
                isLoading,
                showLoader,
                hideLoader,
                notifications,
                addNotification,
                removeNotification
            }}
        >
            {children}
        </UIContext.Provider>
    );
};

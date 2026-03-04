import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ChatContext = createContext(null);

export const useChatContext = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error("useChatContext must be used within a ChatProvider");
    }
    return context;
};

export const ChatProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('empty'); // 'empty' | 'loading' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState(null);

    const clearConversation = useCallback(() => {
        setMessages([]);
        setStatus('empty');
        setErrorMsg(null);
    }, []);

    return (
        <ChatContext.Provider
            value={{
                messages,
                setMessages,
                status,
                setStatus,
                errorMsg,
                setErrorMsg,
                clearConversation
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};

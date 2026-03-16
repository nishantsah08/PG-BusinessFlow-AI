import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

const MasterAITab = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello! I am Kalyani, your Head of Operations & Sales. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const hydratedContext = useRef(false);

    useEffect(() => {
        const context = searchParams.get('context');
        if (!context || hydratedContext.current) return;

        if (context === 'finance') {
            setMessages((current) => ([
                ...current,
                {
                    role: 'assistant',
                    content: 'Finance context is ready. You can ask about pending approvals, unit collections, or initiate a finance workflow request here.',
                },
            ]));
            setInput('Help me with Finance.');
        }
        hydratedContext.current = true;
        setSearchParams((params) => {
            params.delete('context');
            return params;
        }, { replace: true });
    }, [searchParams, setSearchParams]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const newMessages = [...messages, { role: 'user', content: input }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const response = await apiClient.post('/api/communications/chat', {
                messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                user: user
            });
            setMessages([...newMessages, {
                role: response?.data?.role || 'assistant',
                content: response?.data?.content || response?.error || 'No response content.'
            }]);
        } catch (error) {
            console.error(error);
            setMessages([...newMessages, { role: 'assistant', content: 'Error connecting to the backend.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Master AI Orchestrator</h2>
                <div className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    Online
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 ml-3' : 'bg-emerald-600 mr-3'}`}>
                                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                            </div>
                            <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2 ml-11">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100">
                <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Message Master AI..."
                        className="flex-1 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MasterAITab;

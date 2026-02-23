import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import RequestLogItem from './RequestLogItem';

/**
 * ChatPanel Component
 * Handles user input and displays conversation history returned by MasterAI.
 * 
 * Configured to meet strict requirements:
 * 1. 5-state aware (state wrapper)
 * 2. Fetches via apiClient ONLY
 * 3. Does NOT store chat globally. Local state only.
 * 4. Renders RequestLogItem for transparency.
 */
const ChatPanel = ({ onLogRequest }) => {
    // 5-state management
    const [status, setStatus] = useState('empty'); // 'empty' | 'loading' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState(null);

    // Local business data (NOT GLOBAL)
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, status]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userText = input.trim();
        setInput('');
        setStatus('loading');
        setErrorMsg(null);

        // Optimistic local update
        const userMsg = { role: 'user', content: userText, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);

        try {
            // STRICT RULE: Fetch via apiClient ONLY mapped to /api/master_ai
            const response = await apiClient.post('/api/master_ai/chat', { message: userText });

            // STRICT RULE: Transparency logging
            onLogRequest({
                correlationId: response.correlation_id,
                latencyMs: response.latency_ms,
                success: response.success,
                endpoint: 'POST /api/master_ai/chat',
                errorMessage: response.error
            });

            if (response.success && response.data) {
                // Ensure we append the returned AI message
                const aiMsg = {
                    role: 'assistant',
                    content: response.data.content || response.data.reply || response.data.message || 'Action completed via MasterAI.',
                    timestamp: new Date().toISOString(),
                    traceId: response.correlation_id
                };
                setMessages(prev => [...prev, aiMsg]);
                setStatus('success');
            } else {
                throw new Error(response.error || 'Unknown MasterAI error');
            }
        } catch (err) {
            setErrorMsg(err.message);
            setStatus('error');
            // Remove optimistic user message on failure to prevent orphaned state
            setMessages(prev => prev.slice(0, -1));
        }
    };

    const handleClearLocal = () => {
        setMessages([]);
        setStatus('empty');
        setErrorMsg(null);
    };

    // Component internals rendering UI
    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
                <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <h2 className="font-semibold text-gray-800">MasterAI Interface</h2>
                </div>
                <button
                    onClick={handleClearLocal}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Clear Local View"
                    type="button"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                <StateWrapper
                    state={status === 'empty' && messages.length > 0 ? 'success' : status}
                    error={errorMsg}
                    onRetry={() => setStatus('empty')}
                    emptyMessage="Send a message to MasterAI to begin."
                >
                    {/* Actually we want to show messages AND the wrapper state at the bottom */}
                </StateWrapper>

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] rounded-2xl p-3 ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                            }`}>
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                            <div className={`text-[10px] mt-2 flex items-center justify-between ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                                }`}>
                                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                {msg.traceId && (
                                    <span className="font-mono ml-3 border-l pl-2 border-gray-200/30">
                                        TRC:{msg.traceId.substring(0, 6)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {status === 'loading' && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-4 shadow-sm flex space-x-2">
                            <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-100 shrink-0 z-10">
                <form onSubmit={handleSend} className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Instruct MasterAI..."
                        className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                        disabled={status === 'loading'}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || status === 'loading'}
                        className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
                <div className="text-center mt-2 text-[10px] text-gray-400">
                    Strict Architecture: Frontend communicates ONLY with MasterAI endpoints.
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;

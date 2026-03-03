import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Plus, Paperclip, X, File as FileIcon } from 'lucide-react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import RequestLogItem from './RequestLogItem';
import { useAuth } from '../../context/AuthContext';
import { useTimeDisplay } from '../../hooks/useTimeDisplay';
import { useChatContext } from '../../context/ChatContext';

/**
 * ChatPanel Component
 * Handles user input and displays conversation history returned by MasterAI.
 * 
 * Configured to meet strict requirements:
 * 1. 5-state aware (state wrapper)
 * 2. Fetches via apiClient ONLY
 * 3. Uses ChatContext for persistence across routes.
 * 4. Renders RequestLogItem for transparency.
 * 5. Multimodal support for file attachments using FormData.
 */
const ChatPanel = ({ onLogRequest }) => {
    const { user } = useAuth();
    const { formatTime } = useTimeDisplay();

    // Global chat state via context
    const {
        messages, setMessages,
        status, setStatus,
        errorMsg, setErrorMsg,
        clearConversation
    } = useChatContext();

    // Local inputs
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState([]);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, status]);

    const handleFileSelect = async (e) => {
        if (!e.target.files?.length) return;
        const files = Array.from(e.target.files);

        const readAsDataUrl = (file) => new Promise((resolve) => {
            if (!file.type.startsWith('image/')) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });

        const newAttachments = await Promise.all(files.map(async (file) => ({
            file,
            id: Math.random().toString(36).substring(7),
            preview: await readAsDataUrl(file) // base64 data URL — persistent across renders
        })));
        setAttachments(prev => [...prev, ...newAttachments]);
        e.target.value = '';
    };

    const removeAttachment = (id) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() && attachments.length === 0) return;

        const userText = input.trim();
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height after clear
        }

        setStatus('loading');
        setErrorMsg(null);

        // Optimistic local update — store attachment previews in the message for chat history
        const attachmentPreviews = attachments
            .filter(att => att.preview)
            .map(att => att.preview);

        const userMsg = {
            role: 'user',
            content: userText,
            timestamp: new Date().toISOString(),
            hasAttachments: attachments.length > 0,
            attachmentPreviews: attachmentPreviews.length > 0 ? attachmentPreviews : undefined
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            // Build full conversation history for MasterAI (so it remembers context)
            const fullHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

            let response;

            if (attachments.length > 0) {
                // Multimodal request
                const formData = new FormData();
                formData.append('messages', JSON.stringify(fullHistory));
                formData.append('user', JSON.stringify(user));
                attachments.forEach(att => {
                    formData.append('attachments', att.file);
                });
                response = await apiClient.post('/api/communications/chat', formData);
            } else {
                // Standard text request
                response = await apiClient.post('/api/communications/chat', { messages: fullHistory, user: user });
            }

            // STRICT RULE: Transparency logging
            onLogRequest({
                correlationId: response.correlation_id,
                latencyMs: response.latency_ms,
                success: response.success,
                endpoint: 'POST /api/communications/chat',
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

                // Clear attachments on success
                setAttachments([]);

                // Auto-focus textarea
                setTimeout(() => textareaRef.current?.focus(), 10);
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

    const handleNewConversation = () => {
        clearConversation();
        setAttachments([]);
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        setTimeout(() => textareaRef.current?.focus(), 10);
    };

    const handleRetry = () => {
        setStatus('empty');
        setTimeout(() => textareaRef.current?.focus(), 10);
    }

    // Component internals rendering UI
    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
                <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <h2 className="font-semibold text-gray-800">MasterAI Interface</h2>
                </div>
                <button
                    onClick={handleNewConversation}
                    className="flex items-center space-x-1 p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm font-medium"
                    title="New Conversation"
                    type="button"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">New Chat</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                <StateWrapper
                    state={status === 'empty' && messages.length > 0 ? 'success' : status}
                    error={errorMsg}
                    onRetry={handleRetry}
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

                            {msg.hasAttachments && (
                                <div className="mb-2">
                                    {msg.attachmentPreviews && msg.attachmentPreviews.length > 0 ? (
                                        <div className="flex gap-1.5 flex-wrap mb-1">
                                            {msg.attachmentPreviews.map((src, i) => (
                                                <img key={i} src={src} alt="attachment" className="h-20 w-20 object-cover rounded-lg border border-white/20" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-1 text-indigo-200 text-xs">
                                            <Paperclip className="w-3 h-3" />
                                            <span>Attachments included</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

                            <div className={`text-[10px] mt-2 flex items-center justify-between ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                                }`}>
                                <span>{formatTime(msg.timestamp).time}</span>
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
                {/* Image Previews */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                        {attachments.map(att => (
                            <div key={att.id} className="relative shrink-0 bg-gray-100 rounded-lg p-1 border border-gray-200">
                                {att.preview ? (
                                    <img src={att.preview} alt="preview" className="h-16 w-16 object-cover rounded-md" />
                                ) : (
                                    <div className="h-16 w-16 flex flex-col items-center justify-center text-xs text-gray-500 bg-gray-50 rounded-md">
                                        <FileIcon className="w-6 h-6 mb-1 text-gray-400" />
                                        <span className="truncate w-14 text-center block">{att.file.name}</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeAttachment(att.id)}
                                    className="absolute -top-2 -right-2 bg-white text-gray-500 hover:text-red-500 rounded-full p-0.5 shadow-sm border border-gray-200"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSend} className="relative flex items-end bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all p-1">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={status === 'loading'}
                        className="p-2.5 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 shrink-0 mb-0.5"
                        title="Attach files"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                    />

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto'; // Reset height to auto to get actual scrollHeight
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                        placeholder="Instruct MasterAI..."
                        className="w-full py-3 px-2 bg-transparent focus:outline-none text-sm resize-none overflow-y-auto block whitespace-pre-wrap max-h-[160px]"
                        rows={1}
                        style={{ minHeight: '44px' }}
                        disabled={status === 'loading'}
                    />

                    <button
                        type="submit"
                        disabled={(!input.trim() && attachments.length === 0) || status === 'loading'}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg transition-colors shrink-0 mb-0.5 mr-0.5"
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

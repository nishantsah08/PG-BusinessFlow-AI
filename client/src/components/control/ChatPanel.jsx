import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Plus, Paperclip, X, File as FileIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import RequestLogItem from './RequestLogItem';
import { useAuth } from '../../context/AuthContext';
import { useTimeDisplay } from '../../hooks/useTimeDisplay';
import { useChatContext } from '../../context/ChatContext';

const IMAGE_MD_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

const normalizeImageSource = (src) => {
    if (!src || typeof src !== 'string') return src;
    let normalized = src.trim();

    // Remove surrounding wrappers sometimes produced by LLM formatting.
    normalized = normalized.replace(/^<+|>+$/g, '');
    normalized = normalized.replace(/^['"]+|['"]+$/g, '');

    // Remove common trailing punctuation artifacts from prose lists.
    normalized = normalized.replace(/[),.;:!?]+$/g, (m) => (m.includes(')') ? ')' : ''));

    if (normalized.startsWith('sandbox:/images/')) {
        normalized = normalized.replace(/^sandbox:/, '');
    }
    return normalized;
};

const isImageSource = (src) => {
    if (!src || typeof src !== 'string') return false;
    if (src.startsWith('data:image/')) return true;
    if (src.startsWith('/images/')) return true;
    if (src.startsWith('sandbox:/images/')) return true;
    return /^https?:\/\/.+/i.test(src) && /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(src);
};

const renderWorkflowTextBlock = (content) => {
    if (typeof content !== 'string') return null;
    const text = content.trim();
    if (!text) return null;

    if (text.startsWith('Visible workflows:')) {
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        const title = lines[0];
        const items = lines.filter((line) => line.startsWith('- '));
        const helper = lines.find((line) => line.toLowerCase().startsWith('say "show details on'));
        return (
            <div className="space-y-2">
                <div className="text-sm font-semibold text-indigo-700">{title}</div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2">
                    {items.map((item) => (
                        <div key={item} className="font-mono text-xs text-indigo-900">{item}</div>
                    ))}
                </div>
                {helper ? <div className="text-xs text-indigo-700">{helper}</div> : null}
            </div>
        );
    }

    if (!text.startsWith('Workflow:')) return null;

    const lines = text.split('\n');
    const metaRows = [];
    const steps = [];
    const notes = [];
    let inSteps = false;

    lines.forEach((lineRaw) => {
        const line = lineRaw.trim();
        if (!line) return;
        if (line === 'Steps in plain English:') {
            inSteps = true;
            return;
        }
        if (/^\d+\.\s+/.test(line)) {
            steps.push(line);
            return;
        }
        if (line.startsWith('Approval:') || line.startsWith('Failure rule:') || line.startsWith('Workflow:') || line.startsWith('ID:') || line.startsWith('When it runs:')) {
            metaRows.push(line);
            return;
        }
        if (inSteps) notes.push(line);
        else metaRows.push(line);
    });

    return (
        <div className="space-y-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                {metaRows.map((row) => {
                    const [label, ...rest] = row.split(':');
                    if (rest.length === 0) return <div key={row} className="text-xs text-slate-800">{row}</div>;
                    return (
                        <div key={row} className="text-xs">
                            <span className="font-semibold uppercase tracking-wide text-slate-600">{label}:</span>{' '}
                            <span className="text-slate-900">{rest.join(':').trim()}</span>
                        </div>
                    );
                })}
            </div>
            {steps.length > 0 ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Steps In Plain English</div>
                    {steps.map((step) => (
                        <div key={step} className="text-xs text-emerald-900">{step}</div>
                    ))}
                </div>
            ) : null}
            {notes.map((line) => (
                <div key={line} className="text-xs text-slate-700">{line}</div>
            ))}
        </div>
    );
};

const renderMessageContent = (msg, onOpenImage) => {
    if (typeof msg.content !== 'string') {
        return <div className="text-sm whitespace-pre-wrap">{msg.content}</div>;
    }

    if (msg.role !== 'assistant') {
        return <div className="text-sm whitespace-pre-wrap">{msg.content}</div>;
    }

    const workflowBlock = renderWorkflowTextBlock(msg.content);
    if (workflowBlock) {
        return workflowBlock;
    }

    const blocks = [];
    const allImages = [];

    for (const line of msg.content.split('\n')) {
        const matches = [...line.matchAll(IMAGE_MD_REGEX)];

        if (matches.length === 0) {
            blocks.push({ type: 'text', text: line });
            continue;
        }

        const lineImages = matches
            .map((m) => {
                const label = (m[1] || '').trim();
                const candidate = normalizeImageSource((m[2] || '').trim());
                if (!isImageSource(candidate)) return null;
                const image = {
                    src: candidate,
                    label: label || 'Image',
                    globalIndex: allImages.length
                };
                allImages.push(image);
                return image;
            })
            .filter(Boolean);

        if (lineImages.length > 0) {
            blocks.push({ type: 'images', images: lineImages });
        }

        const remainder = line
            .replace(IMAGE_MD_REGEX, '')
            .replace(/^\s*\d+\.\s*/, '')
            .trim();
        if (remainder) {
            blocks.push({ type: 'text', text: remainder });
        }
    }

    if (allImages.length === 0) {
        return <div className="text-sm whitespace-pre-wrap">{msg.content}</div>;
    }

    const mergedBlocks = [];
    for (const block of blocks) {
        if (block.type !== 'images') {
            mergedBlocks.push(block);
            continue;
        }

        const prev = mergedBlocks[mergedBlocks.length - 1];
        if (prev && prev.type === 'images') {
            prev.images = [...prev.images, ...block.images];
        } else {
            mergedBlocks.push({ ...block });
        }
    }

    const cleanedBlocks = mergedBlocks.filter((block, idx) => {
        if (block.type !== 'text') return true;
        const text = (block.text || '').trim();
        if (!text) return false;

        const prevIsImages = idx > 0 && mergedBlocks[idx - 1]?.type === 'images';
        const nextIsImages = idx < mergedBlocks.length - 1 && mergedBlocks[idx + 1]?.type === 'images';
        const isPureSeparator = /^[-•]+$/.test(text);

        if ((prevIsImages || nextIsImages) && isPureSeparator) return false;
        return true;
    });

    return (
        <div className="space-y-2">
            {cleanedBlocks.map((block, idx) => {
                if (block.type === 'text') {
                    return (
                        <div key={`text-${idx}`} className="text-sm whitespace-pre-wrap">
                            {block.text}
                        </div>
                    );
                }

                return (
                    <div key={`images-wrap-${idx}`} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                        <div
                            className="flex gap-3 overflow-x-auto pb-1"
                            data-testid="assistant-image-strip"
                        >
                            {block.images.map((img) => {
                                return (
                                    <button
                                        key={`${img.src}-${img.globalIndex}`}
                                        type="button"
                                        onClick={() => onOpenImage(allImages.map(i => i.src), img.globalIndex)}
                                        className="block text-left shrink-0"
                                        data-testid="inline-image-button"
                                    >
                                        <img
                                            src={img.src}
                                            alt={`attachment-${img.globalIndex + 1}`}
                                            className="w-40 h-32 object-cover rounded-lg border border-gray-200 bg-white"
                                            loading="lazy"
                                        />
                                        <div className="mt-1 text-[11px] text-gray-500">{img.label}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const toHistoryMessage = (m) => {
    const baseContent = typeof m.content === 'string' ? m.content : '';
    if (m?.role !== 'user') {
        return { role: m.role, content: baseContent };
    }

    const hasMarker = /\[Attached\s+\d+\s+image\(s\)\s+—\s+use these as image_urls:/i.test(baseContent);
    if (hasMarker || !Array.isArray(m.imageUrls) || m.imageUrls.length === 0) {
        return { role: m.role, content: baseContent };
    }

    const imageNote = `\n\n[Attached ${m.imageUrls.length} image(s) — use these as image_urls: ${m.imageUrls.join(', ')}]`;
    return { role: m.role, content: `${baseContent}${imageNote}`.trim() };
};

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
    const [imageLightbox, setImageLightbox] = useState({ open: false, images: [], index: 0 });

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, status]);

    useEffect(() => {
        if (!imageLightbox.open) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                setImageLightbox({ open: false, images: [], index: 0 });
                return;
            }
            if (e.key === 'ArrowLeft') {
                setImageLightbox(prev => ({
                    ...prev,
                    index: prev.images.length === 0 ? 0 : (prev.index - 1 + prev.images.length) % prev.images.length
                }));
                return;
            }
            if (e.key === 'ArrowRight') {
                setImageLightbox(prev => ({
                    ...prev,
                    index: prev.images.length === 0 ? 0 : (prev.index + 1) % prev.images.length
                }));
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [imageLightbox.open]);

    const openImageLightbox = (images, index) => {
        if (!Array.isArray(images) || images.length === 0) return;
        setImageLightbox({ open: true, images, index });
    };

    const closeImageLightbox = () => {
        setImageLightbox({ open: false, images: [], index: 0 });
    };

    const showPrevImage = () => {
        setImageLightbox(prev => ({
            ...prev,
            index: prev.images.length === 0 ? 0 : (prev.index - 1 + prev.images.length) % prev.images.length
        }));
    };

    const showNextImage = () => {
        setImageLightbox(prev => ({
            ...prev,
            index: prev.images.length === 0 ? 0 : (prev.index + 1) % prev.images.length
        }));
    };

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
            const fullHistory = [...messages, userMsg].map(toHistoryMessage);

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
                setMessages(prev => {
                    const next = [...prev];
                    const uploaded = Array.isArray(response.uploaded_image_urls) ? response.uploaded_image_urls : [];
                    if (uploaded.length > 0) {
                        const lastUserIdx = [...next].reverse().findIndex(m => m.role === 'user');
                        if (lastUserIdx !== -1) {
                            const idx = next.length - 1 - lastUserIdx;
                            next[idx] = { ...next[idx], imageUrls: uploaded };
                        }
                    }
                    next.push(aiMsg);
                    return next;
                });
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

                            {renderMessageContent(msg, openImageLightbox)}

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

            {imageLightbox.open && (
                <div className="fixed inset-0 z-[2147483647] bg-black/90 flex items-center justify-center p-4" data-testid="image-lightbox">
                    <button
                        type="button"
                        onClick={closeImageLightbox}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                        aria-label="Close image viewer"
                        data-testid="lightbox-close"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={showPrevImage}
                        className="absolute left-4 md:left-8 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                        aria-label="Previous image"
                        data-testid="lightbox-prev"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <div className="w-full max-w-5xl flex flex-col items-center gap-3">
                        <img
                            src={imageLightbox.images[imageLightbox.index]}
                            alt={`expanded-${imageLightbox.index + 1}`}
                            className="max-h-[78vh] w-auto max-w-full object-contain rounded-lg border border-white/20"
                            data-testid="lightbox-image"
                        />
                        <div className="text-white/90 text-xs">
                            {imageLightbox.index + 1} / {imageLightbox.images.length}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={showNextImage}
                        className="absolute right-4 md:right-8 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                        aria-label="Next image"
                        data-testid="lightbox-next"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useChatHistory } from './hooks/useChatHistory';
import Sidebar from './components/Sidebar';
import ChatDisplay from './components/ChatDisplay';
import SettingsModal from './components/SettingsModal';
import CameraModal from './components/CameraModal';
import Legend from './components/Legend';
import { startChat, sendMessage } from './services/geminiService';
import type { ChatFile, ChatMessage } from './types';
import { PaperClipIcon, CameraIcon, PaperAirplaneIcon } from './components/icons';

function App() {
    const { sessions, currentChatId, currentSession, newChat, selectChat, updateChat, deleteChat } = useChatHistory();
    
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [cameraModalOpen, setCameraModalOpen] = useState(false);

    const [input, setInput] = useState('');
    const [file, setFile] = useState<ChatFile | null>(null);
    const [isSending, setIsSending] = useState(false);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    useEffect(() => {
        if (textareaRef.current) {
            handleTextareaInput({ currentTarget: textareaRef.current } as React.FormEvent<HTMLTextAreaElement>);
        }
    }, [input]);

    const handleSendMessage = useCallback(async (messageText: string, messageFile?: ChatFile | null, messageIdToRetry?: string) => {
        if ((!messageText.trim() && !messageFile) || !currentChatId || !currentSession) return;

        setIsSending(true);

        const userMessageId = messageIdToRetry || uuidv4();
        const userMessage: ChatMessage = {
            id: userMessageId,
            role: 'user',
            text: messageText,
            file: messageFile,
            timestamp: Date.now(),
            status: 'complete',
        };
        
        const modelMessageId = uuidv4();
        const modelMessage: ChatMessage = {
            id: modelMessageId,
            role: 'model',
            text: '',
            timestamp: Date.now(),
            status: 'pending',
        };

        if (messageIdToRetry) {
            updateChat(currentChatId, {
                messages: (prev) => prev.filter(m => m.id !== messageIdToRetry)
            });
        }
        
        updateChat(currentChatId, {
             messages: (prev) => [...prev, userMessage, modelMessage],
        });

        setInput('');
        setFile(null);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        try {
            const chat = await startChat(currentSession.history);
            
            const handleStreamChunk = (text: string) => {
                updateChat(currentChatId, {
                    messages: (prev) => prev.map(msg => 
                        msg.id === modelMessageId 
                            ? { ...msg, text, status: 'pending' } // Keep status pending while streaming
                            : msg
                    )
                });
            };

            const { text: finalResponseText, groundingChunks } = await sendMessage(chat, messageText, messageFile || undefined, handleStreamChunk);

            updateChat(currentChatId, {
                history: chat.history,
                messages: (prev) => prev.map(msg => 
                    msg.id === modelMessageId 
                        ? { ...msg, text: finalResponseText, status: 'complete', timestamp: Date.now(), groundingChunks } 
                        : msg
                )
            });

        } catch (error) {
            console.error("Failed to send message:", error);
            updateChat(currentChatId, {
                messages: (prev) => prev.map(msg => 
                    msg.id === userMessageId 
                        ? { ...msg, status: 'error' } 
                        : msg
                ).filter(m => m.id !== modelMessageId)
            });
        } finally {
            setIsSending(false);
        }
    }, [currentChatId, currentSession, updateChat]);
    
    const handleSuggestedQuestionClick = (question: string) => {
        handleSendMessage(question, null);
    };

    const handleRetry = (messageId: string) => {
        const messageToRetry = currentSession?.messages.find(m => m.id === messageId);
        if(messageToRetry) {
            handleSendMessage(messageToRetry.text, messageToRetry.file, messageId);
        }
    };

    const handleRegenerate = () => {
        if (!currentSession || isSending) return;
        const lastUserMessage = [...currentSession.messages].reverse().find(m => m.role === 'user');
        if (lastUserMessage) {
            // Remove the last model response before regenerating
            updateChat(currentSession.id, {
                messages: (prev) => prev.filter(m => m.role !== 'model' || m.id !== currentSession.messages[currentSession.messages.length - 1].id)
            });
            handleSendMessage(lastUserMessage.text, lastUserMessage.file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                setFile({
                    name: selectedFile.name,
                    type: selectedFile.type,
                    dataUrl: loadEvent.target?.result as string,
                });
            };
            reader.readAsDataURL(selectedFile);
        }
    };
    
    const handleSendFromCamera = (dataUrl: string, prompt: string) => {
        const cameraFile: ChatFile = {
            name: `capture_${new Date().toISOString()}.jpg`,
            type: 'image/jpeg',
            dataUrl: dataUrl,
        };
        handleSendMessage(prompt, cameraFile);
        setCameraModalOpen(false);
    };

    const handleNewChat = () => {
        setInput('');
        setFile(null);
        newChat();
    }
    
    const handleSelectChat = (id: string) => {
        setInput('');
        setFile(null);
        selectChat(id);
    }
    
    const handleUpdateTitle = (id: string, title: string) => {
        updateChat(id, { title });
    };

    return (
        <div className="h-screen w-screen flex bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden">
            <Sidebar 
                sessions={sessions}
                currentChatId={currentChatId}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                onDeleteChat={deleteChat}
                onUpdateChatTitle={handleUpdateTitle}
                onSettings={() => setSettingsModalOpen(true)}
                isOpen={sidebarOpen}
                setIsOpen={setSidebarOpen}
            />
             <div className="flex-1 flex flex-col relative">
                 <header className="flex items-center justify-between p-2 sm:p-4 border-b border-slate-200 dark:border-slate-700 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 -ml-2 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                            Baza AI
                        </h1>
                    </div>
                </header>

                <>
                    <ChatDisplay 
                        messages={currentSession?.messages || []} 
                        onRetry={handleRetry}
                        onRegenerate={handleRegenerate}
                        onSuggestedQuestionClick={handleSuggestedQuestionClick}
                        isSending={isSending}
                    />
                    
                    <div className="p-2 sm:p-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="relative flex items-end gap-2">
                            {/* File/Camera Buttons */}
                            <div className="flex flex-col sm:flex-row gap-1">
                                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" title="Ongeraho ifoto cyangwa dosiye">
                                    <PaperClipIcon className="w-6 h-6 text-slate-600 dark:text-slate-300"/>
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf,text/*" />
                                <button onClick={() => setCameraModalOpen(true)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" title="Fata ifoto ukoresheje kamera">
                                    <CameraIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col items-start relative">
                                {file && (
                                    <div className="absolute bottom-full left-0 mb-2 p-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg max-w-xs">
                                        <div className="flex items-center gap-2">
                                            <img src={file.dataUrl} alt="Irebanyuma" className="w-10 h-10 rounded object-cover" />
                                            <span className="text-sm truncate">{file.name}</span>
                                            <button onClick={() => setFile(null)} className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600">&times;</button>
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onInput={handleTextareaInput}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(input, file); } }}
                                    placeholder="Andika ubutumwa bwawe..."
                                    className="w-full max-h-48 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 auto-resize"
                                    rows={1}
                                    disabled={isSending}
                                />
                            </div>

                            <button 
                                onClick={() => handleSendMessage(input, file)} 
                                disabled={isSending || (!input.trim() && !file)} 
                                className="p-2 rounded-full bg-blue-600 text-white transition-colors disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed" 
                                title="Ohereza ubutumwa"
                            >
                                <PaperAirplaneIcon className="w-6 h-6"/>
                            </button>
                        </div>
                    </div>
                    <Legend />
                </>
            </div>
            
            <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} theme={theme} setTheme={setTheme} />
            <CameraModal isOpen={cameraModalOpen} onClose={() => setCameraModalOpen(false)} onSend={handleSendFromCamera} />
        </div>
    );
}

export default App;
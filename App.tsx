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
            if (window.innerWidth <= 768) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const fileData: ChatFile = {
                file: selectedFile,
                preview: URL.createObjectURL(selectedFile),
            };
            setFile(fileData);
        }
    };

    const handleCameraCapture = (capturedFile: File) => {
        const fileData: ChatFile = {
            file: capturedFile,
            preview: URL.createObjectURL(capturedFile),
        };
        setFile(fileData);
        setCameraModalOpen(false);
    };

    const handleSend = useCallback(async () => {
        if ((!input.trim() && !file) || isSending) return;

        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
            file: file || undefined,
        };

        setIsSending(true);
        setInput('');
        setFile(null);

        const updatedMessages = [...(currentSession?.messages || []), userMessage];
        updateChat(currentChatId, updatedMessages);

        try {
            let chat = currentSession?.chat;
            if (!chat) {
                chat = await startChat();
                updateChat(currentChatId, updatedMessages, chat);
            }

            const response = await sendMessage(chat, input.trim(), file?.file);

            const aiMessage: ChatMessage = {
                id: uuidv4(),
                role: 'model',
                content: response,
                timestamp: Date.now(),
            };

            updateChat(currentChatId, [...updatedMessages, aiMessage], chat);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: ChatMessage = {
                id: uuidv4(),
                role: 'model',
                content: 'Sorry, there was an error processing your request.',
                timestamp: Date.now(),
            };
            updateChat(currentChatId, [...updatedMessages, errorMessage]);
        } finally {
            setIsSending(false);
        }
    }, [input, file, isSending, currentSession, currentChatId, updateChat]);

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <Sidebar
                sessions={sessions}
                currentChatId={currentChatId}
                onNewChat={newChat}
                onSelectChat={selectChat}
                onDeleteChat={deleteChat}
                onOpenSettings={() => setSettingsModalOpen(true)}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between transition-colors duration-200">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Baza AI</h1>
                    <div className="w-10" />
                </header>

                <ChatDisplay
                    messages={currentSession?.messages || []}
                    isLoading={isSending}
                />

                <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-colors duration-200">
                    {file && (
                        <div className="mb-2 relative inline-block">
                            <img
                                src={file.preview}
                                alt="Preview"
                                className="h-20 w-20 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                            />
                            <button
                                onClick={() => setFile(null)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <div className="flex gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                disabled={isSending}
                            >
                                <PaperClipIcon />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                onClick={() => setCameraModalOpen(true)}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                disabled={isSending}
                            >
                                <CameraIcon />
                            </button>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Message Baza AI..."
                            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                            style={{ maxHeight: '200px', minHeight: '44px' }}
                            disabled={isSending}
                        />
                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && !file) || isSending}
                            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            <PaperAirplaneIcon />
                        </button>
                    </div>
                </div>
            </div>

            <Legend />

            <SettingsModal
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                theme={theme}
                onThemeChange={setTheme}
            />

            <CameraModal
                isOpen={cameraModalOpen}
                onClose={() => setCameraModalOpen(false)}
                onCapture={handleCameraCapture}
            />
        </div>
    );
}

export default App;

import type { Content } from '@google/genai';

export interface ChatFile {
    name: string;
    type: string; // Mime type
    dataUrl: string; // base64 data url
}

export interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    };
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    file?: ChatFile | null;
    timestamp: number;
    status?: 'pending' | 'error' | 'complete';
    groundingChunks?: GroundingChunk[];
}

export interface ChatSession {
    id:string;
    title: string;
    messages: ChatMessage[];
    history: Content[]; // For Gemini's context
    createdAt: number;
}
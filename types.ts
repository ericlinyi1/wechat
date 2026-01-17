
export enum ToneType {
  PROFESSIONAL = '专业稳重',
  WITTY = '幽默风趣',
  EMPATHETIC = '温柔共情',
  CASUAL = '随性自然',
  DIRECT = '直截了当'
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'friend';
  content: string;
  timestamp: Date;
  type: 'text' | 'image';
  automated?: boolean;
}

export interface ReplySuggestion {
  text: string;
  explanation: string;
}

export interface AnalysisResult {
  summary: string;
  emotionalTone: string;
  intent: string;
  confidence: number; 
  shouldReply: boolean;
  bestReply: string;
  explanation: string;
  lastFriendMessage: string;
  detectedTone?: ToneType; // 新增：AI 自动选定的人格
}

export interface AutoLog {
  id: string;
  time: Date;
  event: string;
  status: 'success' | 'pending' | 'error';
}

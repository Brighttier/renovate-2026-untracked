export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentCode: string;
}

export interface DeploymentStatus {
  step: 'idle' | 'version' | 'upload' | 'finalizing' | 'complete' | 'error';
  url?: string;
  message?: string;
}

export enum ThinkingLevel {
  LOW = 'LOW',
  HIGH = 'HIGH'
}

export interface Version {
  id: string;
  timestamp: number;
  prompt: string;
  code: string;
}
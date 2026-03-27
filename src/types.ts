export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'user' | 'admin';
}

export interface AnalysisRecord {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'waiting_user' | 'completed' | 'failed';
  currentStep: 'analyst' | 'engineer' | 'reporter' | 'reviewer' | 'critic' | 'done';
  progress: number;
  fileName: string;
  csvData?: string;
  createdAt: string;
  lastMessage?: string;
  error?: string;
  htmlReport?: string;
  userApproved?: boolean;
  userFeedback?: string;
  results?: {
    analystOutput?: string;
    engineerOutput?: string;
    reporterOutput?: string;
    reviewerOutput?: string;
    criticOutput?: {
      score: number;
      critique: string;
      recommendations: {
        analyst: string;
        engineer: string;
        reporter: string;
        reviewer: string;
      };
      isApproved: boolean;
    };
    reportContent?: string;
    markdownReport?: string;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  agent?: string;
  content: string;
  timestamp: string;
}

export interface ConversationRecord {
  analysisId: string;
  messages: Message[];
}

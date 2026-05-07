export type EmotionalState = 'CALM' | 'EXCITED' | 'ANXIOUS' | 'ANGRY' | 'TIRED' | 'CONFIDENT' | 'FEAR' | 'REVENGE' | 'FOMO';

export interface Trade {
  id?: string;
  userId: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  targetPrice?: number;
  quantity: number;
  brokerage: number;
  pnl: number;
  imageUrl?: string;
  tags?: string[];
  riskPercentage?: number;
  setupType: string;
  side: 'LONG' | 'SHORT';
  entryTime: string;
  exitTime: string;
  
  // Professional Context
  tradeReason?: string;
  marketCondition?: 'TRENDING_UP' | 'TRENDING_DOWN' | 'SIDEWAYS' | 'CHOPPY' | 'VOLATILE';
  confirmations?: string[];
  
  // Execution Quality
  executionQuality: {
    entry: 'EARLY' | 'PERFECT' | 'LATE';
    exit: 'EARLY' | 'PERFECT' | 'LATE';
    followedSL: boolean;
    followedPlan: boolean;
    respectedRR: boolean;
  };

  // Psychology
  psychology: {
    before: EmotionalState;
    during: EmotionalState;
    after: EmotionalState;
    boredomTrade: boolean;
    revengeTrade: boolean;
    pressureToWin: boolean;
  };

  // Market Context
  marketContext: {
    overallTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    volatility: 'LOW' | 'HIGH' | 'MEDIUM';
    newsEvent: boolean;
  };

  mistakes: string[];
  createdAt: any;
}

export interface DailyChecklist {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  followedRisk: boolean;
  noFOMO: boolean;
  waitedForConfirmation: boolean;
  avoidedNews: boolean;
  plannedTrade: boolean;
  disciplineScore: number;
  createdAt: any;
}

export interface AIInsight {
  id?: string;
  userId: string;
  type: 'DAILY' | 'WEEKLY';
  period: string; // '2024-03-20' or '2024-W12'
  content: string;
  disciplineScore?: number;
  topMistakes?: string[];
  suggestions?: string[];
  createdAt: any;
}

export interface UserSettings {
  userId: string;
  dailyLossLimit: number;
  singleTradeLossLimit: number;
  monthlyLossLimit: number;
  totalCapital: number;
  riskBaseCurrency: string;
  updatedAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

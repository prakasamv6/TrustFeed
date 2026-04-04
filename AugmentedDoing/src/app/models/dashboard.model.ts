import { AgentName, BiasRegion, ContentModality } from './analysis.model';

export interface DashboardSummary {
  totalAnalyzedPosts: number;
  totalBiasFlaggedPosts: number;
  totalDebiasedPosts: number;
  averageBiasDelta: number;
  averageDisagreementRate: number;
  averageRegionDominance: number;
  modalityBreakdown: Record<ContentModality, number>;
}

export interface AgentStat {
  agentName: AgentName;
  region: BiasRegion | 'None';
  totalSelections: number;
  averageScore: number;
  favoritismRate: number;
  averageBiasDelta: number;
}

export interface DashboardAgentStats {
  agents: AgentStat[];
}

export interface TrendPoint {
  date: string;
  averageBiasDelta: number;
  averageDebiasedScore: number;
  totalAnalyzed: number;
  biasFlaggedCount: number;
}

export interface DashboardTrends {
  points: TrendPoint[];
}

export interface PostDrilldown {
  postId: string;
  author: string;
  contentType: ContentModality;
  aiDeclared: boolean;
  rawBiasedScore: number;
  baselineScore: number;
  debiasedScore: number;
  biasDelta: number;
  favoritismFlag: boolean;
  dominantAgent: AgentName | null;
  favoredRegion: BiasRegion | null;
  analyzedAt: string;
}

// ── Fairness Trends ─────────────────────────────────────────────────────────

export interface FairnessTrendPoint {
  date: string;
  avgOriginalFairness: number;
  avgNonbiasedFairness: number;
  avgExplanationClarity: number;
  avgTrustImpact: number;
  avgPerceivedBias: number;
  responseCount: number;
}

export interface FairnessTrends {
  points: FairnessTrendPoint[];
}

// ── Survey Completion Stats ─────────────────────────────────────────────────

export interface SurveyCompletionStats {
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  completionRate: number;
  avgAccuracy: number;
  avgItemsPerSession: number;
  byMode: { mode: string; sessions: number; avgAccuracy: number }[];
  byDifficulty: { difficulty: string; total: number; correct: number; accuracy: number }[];
  recentCompletions: { date: string; completedCount: number }[];
}

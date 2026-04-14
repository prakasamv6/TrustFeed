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

// ── Agent Tracking (Live DB) ────────────────────────────────────────────

export interface AgentTrackingStat {
  agent_name: string;
  agent_region: string;
  total_analyses: number;
  avg_score: number;
  min_score: number;
  max_score: number;
  score_stddev: number;
  avg_confidence: number;
  avg_bias_delta: number;
  avg_disagreement: number;
}

export interface RecentAnalysisLog {
  post_id: string;
  agent_name: string;
  agent_region: string;
  score: number;
  confidence: number;
  bias_delta: number;
  disagreement_rate: number;
  created_at: string;
}

export interface SurveyVerdictStat {
  agent_region: string;
  total_verdicts: number;
  correct_count: number;
  accuracy: number;
  avg_confidence: number;
}

export interface AgentTrackingResponse {
  feedAnalysis: {
    agentStats: AgentTrackingStat[];
    recentLogs: RecentAnalysisLog[];
  };
  surveyVerdicts: SurveyVerdictStat[];
  totalFeedAnalyses: number;
  totalSurveyVerdicts: number;
}

// ── Analytics (Live DB) ─────────────────────────────────────────────────

export interface AnalyticsResponse {
  totalCompletedSessions: number;
  accuracyByMode: { mode: string; sessions: number; avg_accuracy: number }[];
  accuracyByDifficulty: { item_difficulty: string; total: number; correct: number; accuracy: number; avg_confidence: number }[];
  agentAccuracy: { agent_region: string; total: number; correct: number; accuracy: number; avg_confidence: number }[];
  accuracyByCategory: { item_category: string; total: number; correct: number; accuracy: number }[];
}

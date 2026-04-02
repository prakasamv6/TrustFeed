export type BiasRegion = 'Africa' | 'Asia' | 'Europe' | 'Americas' | 'Oceania';

export type AgentName =
  | 'AfricaBiasAgent'
  | 'AsiaBiasAgent'
  | 'EuropeBiasAgent'
  | 'AmericasBiasAgent'
  | 'OceaniaBiasAgent'
  | 'NonBiasBaselineAgent';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ContentModality = 'text' | 'image' | 'video';

export interface AgentScore {
  agentName: AgentName;
  region: BiasRegion | 'None';
  score: number;
  confidence: number;
  favoredSegments: string[];
  explanation: string;
}

export interface BiasAnalysisResult {
  postId: string;
  contentType: ContentModality;
  status: AnalysisStatus;
  agentScores: AgentScore[];
  rawBiasedScore: number;
  baselineNonbiasedScore: number;
  biasDelta: number;
  biasAmplificationIndex: number;
  disagreementRate: number;
  regionDominanceScore: number;
  favoritismFlag: boolean;
  deductedBiasAmount: number;
  debiasedAdjustedScore: number;
  dominantBiasedAgent: AgentName | null;
  favoredRegion: BiasRegion | null;
  favoredSegments: string[];
  explanationSummary: string;
  reportPath: string | null;
  analyzedAt: string;
}

export interface AnalysisRequest {
  postId: string;
  contentType: ContentModality;
  content: string;
  mediaUrl?: string;
  localFilePath?: string;
}

// ── Factor Attribution ──────────────────────────────────────────────────────

export type FactorCategory = 'feature_weight' | 'text_sensitivity' | 'bias_direction';

export interface FactorContribution {
  factorName: string;
  factorCategory: FactorCategory;
  rawValue: number;
  weight: number;
  contribution: number;
  contributionPct: number;
  description: string;
}

export interface AgentAttribution {
  agentName: string;
  region: BiasRegion | null;
  agentScore: number;
  baselineScore: number;
  totalDelta: number;
  factors: FactorContribution[];
  topFactor: string;
  summary: string;
}

export interface FactorAttributionReport {
  agentAttributions: AgentAttribution[];
  globalTopFactors: string[];
  proxyRiskIndicators: string[];
  fairnessSummary: string;
}

// ── Fairness Survey ─────────────────────────────────────────────────────────

export interface FairnessSurveyRequest {
  postId: string;
  originalFairness: number;
  nonbiasedFairness: number;
  explanationClarity: number;
  trustImpact: number;
  perceivedBiasSeverity: number;
  comment: string;
}

export interface FairnessSurveyResponseItem {
  id: string;
  originalFairness: number;
  nonbiasedFairness: number;
  explanationClarity: number;
  trustImpact: number;
  perceivedBiasSeverity: number;
  comment: string;
  createdAt: string;
}

export interface FairnessSurveySummary {
  avgOriginalFairness: number;
  avgNonbiasedFairness: number;
  avgExplanationClarity: number;
  avgTrustImpact: number;
  avgPerceivedBias: number;
  responseCount: number;
}

export interface FairnessSurveyResult {
  postId: string;
  responses: FairnessSurveyResponseItem[];
  summary: FairnessSurveySummary | null;
}

export type BiasRegion = 'Africa' | 'Asia' | 'Europe' | 'North_America' | 'South_America' | 'Antarctica' | 'Australia';

export type AgentName =
  | 'AfricaBiasAgent'
  | 'AsiaBiasAgent'
  | 'EuropeBiasAgent'
  | 'NorthAmericaBiasAgent'
  | 'SouthAmericaBiasAgent'
  | 'AntarcticaBiasAgent'
  | 'AustraliaBiasAgent'
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

// ── AI Content Detection & Flagging ─────────────────────────────────────────

export type AiLabel = 'ai-generated' | 'likely-ai' | 'uncertain' | 'likely-human' | 'human';

export interface AiDetectionResult {
  overallAiProbability: number;
  trustScore: number;
  recommendedLabel: AiLabel;
  confidence: number;
  linguisticScore: number;
  structuralScore: number;
  statisticalScore: number;
  communityScore: number;
  authorDeclarationWeight: number;
  signals: string[];
  riskFactors: string[];
  recommendation: string;
}

export interface AiFlagSummary {
  postId: string;
  totalFlags: number;
  aiFlags: number;
  humanFlags: number;
  disputedFlags: number;
  misleadingFlags: number;
  avgConfidence: number;
  recommendedLabel: string;
  consensusStrength: number;
}

export interface CorrectiveAction {
  actionId: string;
  category: 'labeling' | 'suppression' | 'transparency' | 'escalation' | 'education';
  severity: 'info' | 'advisory' | 'recommended' | 'required';
  title: string;
  description: string;
  rationale: string;
  automated: boolean;
  applied?: boolean;
}

export interface CorrectiveReport {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  trustScore: number;
  summary: string;
  actions: CorrectiveAction[];
}

export interface ContentTrustResult {
  postId: string;
  detection: AiDetectionResult;
  flags: AiFlagSummary;
  corrections: CorrectiveReport;
}

// ── Trending & Circuit Breaker ──────────────────────────────────────────────

export interface TrendingTopic {
  topic: string;
  postCount: number;
  engagementCount: number;
  velocity: number;
  aiContentRatio: number;
  uniqueAuthors: number;
  coordinationScore: number;
  trustScore: number;
  circuitBroken: boolean;
  breakReason: string;
  breakSeverity: 'none' | 'watch' | 'warning' | 'critical' | 'broken';
  correctiveActions: string[];
  firstSeen: string;
  lastUpdated: string;
}

export interface TrendAlert {
  topic: string;
  alertType: string;
  severity: 'watch' | 'warning' | 'critical';
  message: string;
  evidence: string[];
  recommendedAction: string;
  timestamp: string;
}

export interface TrendingResponse {
  topics: TrendingTopic[];
  alerts: TrendAlert[];
}

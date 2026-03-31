export type ContentModality = 'text' | 'image' | 'video';
export type AnalysisStatusType = 'none' | 'pending' | 'running' | 'completed' | 'failed';

/** Individual agent score from a regional bias agent or baseline. */
export interface AgentScore {
  agentName: string;
  region: string | null;
  score: number;
  confidence: number;
  reasoning: string;
  biasHighlights: string[];
}

/** A single flagged bias item from the bias detector. */
export interface BiasHighlight {
  agentName: string;
  region: string;
  biasMode: 'INFLATION' | 'DEFLATION' | 'SELECTIVE' | 'NEUTRAL';
  deltaFromBaseline: number;
  severity: 'negligible' | 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
}

/** Aggregated bias detection report across all agents. */
export interface BiasDetection {
  mostBiasedAgent: string;
  leastBiasedAgent: string;
  overallBiasLevel: string;
  summary: string;
  flaggedItems: BiasHighlight[];
}

/** Provenance indicator — neutral evidence about content origin (proposal §Idea). */
export interface ProvenanceIndicator {
  source: 'author-declaration' | 'community-consensus' | 'ai-analysis' | 'expert-review';
  label: string;
  confidence: number;
  reasoning: string;
}

/** Circuit breaker state — triggered when bias amplification is detected (proposal §Overview). */
export interface CircuitBreakerState {
  triggered: boolean;
  reason: string;
  exposureCount: number;          // how many AI posts user has seen in session
  exposureCap: number;            // max before friction is added
  diversityScore: number;         // 0-1, diversity of content in recent feed
  diversityThreshold: number;     // minimum before constraint activates
  cooldownActive: boolean;        // friction interstitial shown
}

/** Expert escalation for high-risk content (proposal §Overview). */
export interface ExpertEscalation {
  escalated: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  expertVerdict?: string;
  reviewedAt?: Date;
}

export interface BiasResult {
  rawBiasedScore: number;
  baselineNonbiasedScore: number;
  debiasedAdjustedScore: number;
  biasDelta: number;
  deductedBiasAmount: number;
  biasAmplificationIndex: number;
  disagreementRate: number;
  regionDominanceScore: number;
  favoritismFlag: boolean;
  dominantBiasedAgent: string | null;
  favoredRegion: string | null;
  favoredSegments: string[];
  explanationSummary: string;
  reportPath: string | null;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  contentType: ContentModality;
  imageUrl?: string;
  mediaUrl?: string;
  localFilePath?: string;
  createdAt: Date;
  updatedAt?: Date;
  isAiGenerated: boolean;
  aiGeneratedFeedback: AiFeedback;
  likes: number;
  comments: Comment[];
  // Bias analysis fields
  analysisRequested: boolean;
  analysisStatus: AnalysisStatusType;
  biasResult?: BiasResult;
  // Multi-agent analysis fields
  agentScores?: AgentScore[];
  biasDetection?: BiasDetection;
  mlFeatures?: Record<string, number>;
  /** Set true when the AI analysis system has processed this content */
  aiAnalyzed: boolean;
  // Proposal-aligned fields
  /** Neutral provenance indicators — evidence about origin (§Idea). */
  provenance?: ProvenanceIndicator[];
  /** Expert escalation state for high-risk content (§Overview). */
  expertEscalation?: ExpertEscalation;
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  isVerified: boolean;
}

export interface AiFeedback {
  flaggedAsAi: number; // Number of users who flagged as AI
  flaggedAsHuman: number; // Number of users who flagged as human
  userVote?: 'ai' | 'human' | null; // Current user's vote
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: Date;
  isAiGenerated: boolean;
}

export type ContentType = 'all' | 'ai-generated' | 'human-created' | 'disputed'
  | 'bias-flagged' | 'debiased-safe' | 'high-region-dominance' | 'nonbias-baseline';

export type SortMode = 'newest' | 'highest-bias-delta' | 'highest-disagreement'
  | 'highest-region-dominance' | 'likely-human' | 'likely-ai' | 'highest-debiased-confidence';

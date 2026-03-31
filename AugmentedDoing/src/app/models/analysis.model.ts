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

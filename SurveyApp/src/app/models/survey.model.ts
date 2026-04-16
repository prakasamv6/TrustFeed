/** Survey system models — Human evaluates TrustFeed content, agents provide verdicts, results compared. */

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North_America' | 'South_America' | 'Antarctica' | 'Australia';

export interface AgentVerdict {
  agentName: string;
  region: Continent;
  verdict: 'ai' | 'human';
  confidence: number;       // 0-1
  reasoning: string;
  /** Unique media this agent analyzed from its regional perspective */
  analysisImageUrl?: string;
  analysisVideoUrl?: string;
  analysisMediaType?: 'image' | 'video';
}

export interface SurveyItem {
  id: string;
  /** The content shown to the user */
  title: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  contentType: 'text' | 'image' | 'video';
  /** Ground truth — is this actually AI-generated? */
  groundTruth: 'ai' | 'human';
  /** What each continent agent thinks */
  agentVerdicts: AgentVerdict[];
  /** Human's survey response (null until answered) */
  humanVerdict?: 'ai' | 'human' | null;
  /** Human's confidence in their answer (1-5) */
  humanConfidence?: number;
  /** Optional free-text reasoning */
  humanReasoning?: string;
  /** Category of content */
  category: string;
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Source API the content was fetched from */
  source?: string;
  /** Dataset continent the content was loaded from */
  continent?: Continent;
}

/** Raw content item fetched from the API (before agent verdicts are added) */
export interface FetchedContentItem {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  contentType: 'text' | 'image' | 'video';
  groundTruth: 'ai' | 'human';
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: string;
  continent?: Continent;
}

export interface DatasetContinentHealth {
  continent: Continent;
  total: number;
  ai: number;
  human: number;
  media: Partial<Record<'text' | 'image' | 'video', number>>;
}

export interface DatasetHealth {
  ready: boolean;
  requiredSessionSize: number;
  totalItems: number;
  truthCounts: { ai: number; human: number };
  mediaCounts: { text: number; image: number; video: number };
  continents: DatasetContinentHealth[];
  issues: string[];
}

export interface DatasetHealthResponse {
  status: 'ok' | 'warning';
  dataset: DatasetHealth;
}

export interface SurveySession {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  items: SurveyItem[];
  currentIndex: number;
  /** Human AI Collab mode — show agent hints while answering */
  collabMode: boolean;
}

export interface SurveyResults {
  sessionId: string;
  totalItems: number;
  /** Human performance */
  humanCorrect: number;
  humanAccuracy: number;
  humanAiCount: number;   // how many human said AI
  humanHumanCount: number; // how many human said Human
  /** Agent performance per continent */
  agentResults: AgentResult[];
  /** Actual ground truth counts */
  actualAiCount: number;
  actualHumanCount: number;
  /** Human-AI Collab metrics */
  collabMode: boolean;
  /** Agreement matrix: how often human agreed with each agent */
  agreementMatrix: { region: Continent; agreementRate: number }[];
}

export interface AgentResult {
  region: Continent;
  correct: number;
  accuracy: number;
  aiCount: number;    // how many agent said AI
  humanCount: number; // how many agent said Human
  avgConfidence: number;
}

/** Summary of a completed session — used for cross-session comparison dashboard */
export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  collabMode: boolean;
  totalItems: number;
  humanCorrect: number;
  humanAccuracy: number;
  humanAiCount: number;
  humanHumanCount: number;
  actualAiCount: number;
  actualHumanCount: number;
  agentResults: AgentResult[];
  agreementMatrix: { region: Continent; agreementRate: number }[];
}

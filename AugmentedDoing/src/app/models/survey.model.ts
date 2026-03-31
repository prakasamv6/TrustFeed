/** Survey system models — Human evaluates TrustFeed content, agents provide verdicts, results compared. */

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'Americas' | 'Oceania';

export interface AgentVerdict {
  agentName: string;
  region: Continent;
  verdict: 'ai' | 'human';
  confidence: number;       // 0-1
  reasoning: string;
}

export interface SurveyItem {
  id: string;
  /** The content shown to the user */
  title: string;
  content: string;
  imageUrl?: string;
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

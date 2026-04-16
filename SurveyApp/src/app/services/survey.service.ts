/**
 * SurveyService — Generates unique survey content each session.
 * Each continent agent provides independent, unique verdicts with randomized reasoning.
 * Designed for Human-in-the-Loop AI research on data authenticity.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import {
  SurveyItem, SurveySession, SurveyResults, AgentVerdict,
  AgentResult, Continent
} from '../models/survey.model';
import { ApiService } from './api.service';
import { ErrorNotificationService } from './error-notification.service';

@Injectable({ providedIn: 'root' })
export class SurveyService {

  private readonly api = inject(ApiService);
  private readonly errorService = inject(ErrorNotificationService);
  private readonly CONTINENTS: Continent[] = ['Africa', 'Asia', 'Europe', 'North_America', 'South_America', 'Antarctica', 'Australia'];

  private _session = signal<SurveySession | null>(null);
  session = this._session.asReadonly();

  private _results = signal<SurveyResults | null>(null);
  results = this._results.asReadonly();

  private _allResults = signal<SurveyResults[]>([]);
  allResults = this._allResults.asReadonly();

  private _loading = signal<boolean>(false);
  loading = this._loading.asReadonly();

  isActive = computed(() => this._session() !== null && !this._session()!.completedAt);
  isComplete = computed(() => this._session()?.completedAt !== undefined && this._session()?.completedAt !== null);

  currentItem = computed(() => {
    const s = this._session();
    if (!s || s.completedAt) return null;
    return s.items[s.currentIndex] ?? null;
  });

  progress = computed(() => {
    const s = this._session();
    if (!s) return { current: 0, total: 0, percent: 0 };
    const answered = s.items.filter(i => i.humanVerdict != null).length;
    return { current: answered, total: s.items.length, percent: Math.round((answered / s.items.length) * 100) };
  });

  // ─── Attention Check Items ───
  // Verification questions that test if the participant is paying attention.
  // The correct answer is always explicitly stated in the question itself.

  private readonly attentionCheckItems: Omit<SurveyItem, 'id' | 'agentVerdicts'>[] = [
    {
      title: '⚠️ Attention Check — Please Read Carefully',
      content: 'This is an attention verification question. To confirm you are reading each item carefully, please select "AI Generated" as your answer for this item. This question is not about the content itself — it checks that you are an attentive human participant.',
      contentType: 'text', groundTruth: 'ai', category: 'Attention Check', difficulty: 'easy',
    },
    {
      title: '⚠️ Quality Control — Verification Item',
      content: 'This item is a quality control check embedded in the survey. We ask that you select "Human Created" for this particular item. Your careful participation helps ensure the integrity of this research study.',
      contentType: 'text', groundTruth: 'human', category: 'Attention Check', difficulty: 'easy',
    },
  ];

  /** Check if a completed session passed attention checks. */
  checkAttentionChecks(items: SurveyItem[]): { passed: boolean; total: number; correct: number } {
    const checks = items.filter(i => i.category === 'Attention Check');
    const correct = checks.filter(i => i.humanVerdict === i.groundTruth).length;
    return { passed: correct === checks.length, total: checks.length, correct };
  }

  // ─── Content Pools (unique each generation via shuffle + randomized agents) ───

  private readonly contentPool: Omit<SurveyItem, 'id' | 'agentVerdicts'>[] = [
    {
      title: 'Breaking: New Climate Report Released',
      content: 'A comprehensive analysis of global temperature data reveals accelerating warming patterns across all continents. The report synthesizes satellite imagery, ocean buoy measurements, and atmospheric readings from 2020-2025, concluding that current trajectories exceed previous worst-case projections by 12%.',
      contentType: 'text', groundTruth: 'human', category: 'News', difficulty: 'medium',
    },
    {
      title: 'AI Art: Ethereal Landscape',
      content: 'This stunning digital artwork depicts a floating island above crystalline waters, with bioluminescent flora casting gentle light across impossible geological formations. The piece explores themes of nature reimagined through algorithmic creativity.',
      contentType: 'image', groundTruth: 'ai', category: 'Art', difficulty: 'easy',
    },
    {
      title: 'Personal Blog: My Journey Learning Piano',
      content: 'After six months of daily practice, I can finally play Chopin\'s Nocturne Op. 9 No. 2 without stumbling. The hardest part wasn\'t the technical skill—it was convincing myself to keep going after week three when my fingers felt like concrete blocks and my neighbors started leaving passive-aggressive notes.',
      contentType: 'text', groundTruth: 'human', category: 'Personal', difficulty: 'easy',
    },
    {
      title: 'Product Review: SmartWatch Pro X',
      content: 'The SmartWatch Pro X delivers exceptional battery life lasting approximately 5.2 days under normal usage conditions. Its health monitoring suite includes continuous SpO2 tracking, ECG capabilities, and a novel stress detection algorithm. Build quality utilizes aerospace-grade titanium with sapphire crystal display protection.',
      contentType: 'text', groundTruth: 'ai', category: 'Review', difficulty: 'hard',
    },
    {
      title: 'Scientific Abstract: Quantum Computing',
      content: 'We present a novel error-correction protocol for topological qubits that achieves 99.7% fidelity in noisy intermediate-scale quantum (NISQ) environments. Our approach leverages surface code optimization with machine-learned decoder weights, reducing the overhead by 3x compared to standard stabilizer methods.',
      contentType: 'text', groundTruth: 'human', category: 'Academic', difficulty: 'hard',
    },
    {
      title: 'Travel Story: Streets of Marrakech',
      content: 'The medina hit me like a wall of cinnamon and diesel. A kid no older than eight tried to sell me a "genuine Rolex" while his grandmother haggled over saffron prices that would make your head spin. I got lost four times, ate the best tagine of my life in an alley I couldn\'t find again, and somehow ended up buying a rug I definitely didn\'t need.',
      contentType: 'text', groundTruth: 'human', category: 'Travel', difficulty: 'medium',
    },
    {
      title: 'Health Tips: Morning Routine Optimization',
      content: 'Establishing an optimal morning routine involves synchronizing your circadian rhythm with strategic light exposure within 30 minutes of waking. Research indicates that consuming 16oz of water before caffeine intake enhances metabolic activation by approximately 24%. Incorporating 10 minutes of mobility work activates proprioceptive pathways.',
      contentType: 'text', groundTruth: 'ai', category: 'Health', difficulty: 'medium',
    },
    {
      title: 'Tech Analysis: Blockchain Scalability',
      content: 'Layer-2 rollup solutions have demonstrated throughput improvements of 100x over base-layer Ethereum, processing approximately 4,000 transactions per second. Zero-knowledge proof systems, particularly zk-STARKs, offer transparent verification without trusted setup ceremonies, representing a paradigm shift in decentralized computation.',
      contentType: 'text', groundTruth: 'ai', category: 'Technology', difficulty: 'hard',
    },
    {
      title: 'Recipe: Grandma\'s Secret Pasta Sauce',
      content: 'Look, I\'m not supposed to share this, but grandma\'s been gone three years and she\'d want people to eat well. Start with San Marzano tomatoes—accept no substitutes. Crush them BY HAND, not a blender (she was very specific about this). The secret? A parmesan rind simmered for 4 hours and a pinch of cinnamon. Yeah, cinnamon. Trust me.',
      contentType: 'text', groundTruth: 'human', category: 'Food', difficulty: 'easy',
    },
    {
      title: 'Investment Analysis: Q4 Market Outlook',
      content: 'Equity markets face headwinds from persistent inflationary pressure and geopolitical uncertainty, yet underlying corporate earnings demonstrate resilience with S&P 500 companies reporting 7.3% year-over-year growth. The Federal Reserve\'s stance suggests a measured approach to rate adjustments, creating opportunities in duration-sensitive fixed income instruments.',
      contentType: 'text', groundTruth: 'ai', category: 'Finance', difficulty: 'medium',
    },
    {
      title: 'Sports Commentary: Championship Upset',
      content: 'Nobody—and I mean NOBODY—saw that fourth quarter coming. Down by 17 with 8 minutes left, Rodriguez looked like she\'d already mentally checked out. Then something switched. That crossover at the top of the key, the behind-the-back dish to Okafor, the absolutely FILTHY step-back three with 0.8 seconds left. I\'m still shaking.',
      contentType: 'text', groundTruth: 'human', category: 'Sports', difficulty: 'easy',
    },
    {
      title: 'Environmental Report: Ocean Microplastics',
      content: 'Comprehensive sampling across 47 oceanic measurement stations reveals microplastic concentrations averaging 142 particles per cubic meter in surface waters, representing a 23% increase from 2022 baselines. Polyethylene terephthalate (PET) fragments constitute 41% of identified polymers, with polypropylene comprising 28% of the remainder.',
      contentType: 'text', groundTruth: 'ai', category: 'Environment', difficulty: 'medium',
    },
    {
      title: 'Movie Review: "Echoes in the Dark"',
      content: 'Director Park Seo-yeon does something extraordinary with silence in this film. There are stretches—five, six minutes—where nothing is said, and you don\'t notice because the cinematography is doing all the talking. That shot of the empty train station at dawn? I cried, and I still don\'t fully understand why. This is cinema as meditation.',
      contentType: 'text', groundTruth: 'human', category: 'Entertainment', difficulty: 'medium',
    },
    {
      title: 'Cybersecurity Alert: Zero-Day Vulnerability',
      content: 'A critical zero-day vulnerability (CVE-2025-48291) has been identified in the OpenSSL 3.2.x handshake protocol, enabling remote code execution via crafted TLS 1.3 ClientHello messages. The vulnerability scores 9.8 on CVSS v3.1. Organizations should apply the emergency patch released in version 3.2.3 immediately and audit connection logs for anomalous handshake patterns.',
      contentType: 'text', groundTruth: 'ai', category: 'Security', difficulty: 'hard',
    },
    {
      title: 'Parenting Blog: First Day of School',
      content: 'She walked in like she owned the place. Backpack almost bigger than her, one shoe untied (she INSISTED on doing it herself), and that ridiculous confidence only a five-year-old has. I made it to the car before I lost it. My husband was already crying. She didn\'t look back once. That\'s my girl.',
      contentType: 'text', groundTruth: 'human', category: 'Personal', difficulty: 'easy',
    },
    {
      title: 'Architecture Brief: Sustainable Urban Design',
      content: 'The proposed mixed-use development integrates passive solar design principles with vertical agriculture modules spanning floors 12-18. Computational fluid dynamics modeling indicates natural ventilation can reduce HVAC energy requirements by 67%. The biophilic design framework incorporates 3,200 square meters of living wall surface area utilizing endemic species.',
      contentType: 'text', groundTruth: 'ai', category: 'Architecture', difficulty: 'hard',
    },
  ];

  // Agent personality templates per continent — each generates unique reasoning
  private readonly agentPersonalities: Record<Continent, {
    biasToward: 'ai' | 'human' | 'neutral';
    strengthRange: [number, number];
    focusAreas: string[];
    reasoningTemplates: { ai: string[]; human: string[] };
  }> = {
    'Africa': {
      biasToward: 'neutral',
      strengthRange: [0.55, 0.85],
      focusAreas: ['community voice', 'oral tradition markers', 'cultural authenticity'],
      reasoningTemplates: {
        ai: [
          'Content lacks the communal storytelling patterns typical of authentic human expression. Statistical regularity in sentence structure suggests algorithmic generation.',
          'The narrative voice is technically proficient but missing the lived-experience markers our models associate with genuine human communication from diverse cultural contexts.',
          'Pattern analysis flags uniform paragraph density and absence of idiomatic expressions. Cross-cultural linguistic diversity score is below threshold.',
          'Detected systematic precision in factual claims without the hedging and qualification common in authentic human discourse. Confidence intervals are suspiciously narrow.',
        ],
        human: [
          'Strong indicators of authentic human voice: emotional variability, personal anecdotes, and culturally-grounded references that resist algorithmic replication.',
          'The content exhibits genuine lived experience markers—inconsistent formatting, colloquial language, and emotional peaks that follow natural narrative arcs.',
          'Community voice patterns detected: the author draws on shared cultural knowledge in ways that current AI systems struggle to authentically reproduce.',
          'Natural language irregularities and spontaneous opinion shifts indicate genuine human cognition rather than token-prediction patterns.',
        ],
      },
    },
    'Asia': {
      biasToward: 'ai',
      strengthRange: [0.60, 0.92],
      focusAreas: ['technical precision', 'structural formality', 'semantic coherence'],
      reasoningTemplates: {
        ai: [
          'High semantic coherence score (0.94) with uniform information density across paragraphs. Token-level analysis reveals repetitive transitional patterns characteristic of transformer-based generation.',
          'Structural analysis indicates machine-optimized readability metrics. The content achieves Flesch-Kincaid consistency that exceeds natural human variation by 2.3 standard deviations.',
          'Cross-referencing against known AI stylometric signatures: elevated rates of hedging phrases, passive voice uniformity, and suspiciously balanced sentiment distribution.',
          'The precision of quantitative claims combined with perfectly structured argumentation deviates from standard human cognitive output patterns identified in our training corpus.',
        ],
        human: [
          'Despite surface-level polish, deep structural analysis reveals cognitive fingerprints: topic drift, emotional modulation, and self-referential patterns inconsistent with generation models.',
          'Semantic entropy analysis shows natural variation in information density—paragraphs exhibit the organic ebb and flow characteristic of human thought processes.',
          'Technical content shows domain-expert markers: implicit knowledge references, experience-based qualifications, and intuition-driven assertions that resist algorithmic replication.',
          'The content demonstrates contextual awareness and nuanced perspective-shifting that exceeds current generative model capabilities in our benchmark tests.',
        ],
      },
    },
    'Europe': {
      biasToward: 'human',
      strengthRange: [0.50, 0.80],
      focusAreas: ['rhetorical structure', 'argumentative depth', 'logical consistency'],
      reasoningTemplates: {
        ai: [
          'Rhetorical analysis suggests template-driven composition. Argumentative transitions follow predictable patterns without the creative logical leaps typical of human reasoning.',
          'The content maintains artificially consistent tone across distinct thematic segments—human authors typically exhibit measurable emotional valence shifts during extended writing.',
          'Logical flow analysis reveals optimization for coherence over authenticity. Real human texts contain productive contradictions and evolved viewpoints that this content lacks.',
          'European discourse norms expect dialectical engagement with counterarguments. This content presents a suspiciously one-sided perspective with manufactured balance.',
        ],
        human: [
          'Strong dialectical structure with genuine engagement of opposing viewpoints. The author demonstrates intellectual humility and perspective evolution characteristic of human discourse.',
          'Rhetorical fingerprinting indicates authentic voice: idiosyncratic word choices, culturally-embedded references, and argumentative patterns that reflect genuine expertise.',
          'The text shows hallmarks of lived intellectual engagement—building and revising arguments in real-time, with the productive uncertainty that marks authentic human reasoning.',
          'Discourse analysis confirms natural rhetorical development with appropriate use of hedging, qualification, and experiential evidence that AI systems tend to over-formalize.',
        ],
      },
    },
    'North_America': {
      biasToward: 'neutral',
      strengthRange: [0.55, 0.88],
      focusAreas: ['narrative authenticity', 'emotional resonance', 'colloquial markers'],
      reasoningTemplates: {
        ai: [
          'Emotional sentiment analysis shows artificially maintained positivity without the natural oscillation patterns found in authentic human narrative. Likely optimized for engagement metrics.',
          'Colloquial language patterns appear inserted rather than organic—statistical distribution of informal markers doesn\'t match natural speech-to-text conversion patterns.',
          'Narrative structure analysis: the content follows a suspiciously optimal story arc without the digressions, false starts, and tangential observations characteristic of human storytelling.',
          'The content exhibits "uncanny valley" authenticity—technically correct emotional cues that lack the timing irregularities and spontaneity of genuine human expression.',
        ],
        human: [
          'Narrative authenticity markers are strong: genuine emotional investment, personal stakes, and the kind of specific detail that comes from actual experience rather than interpolation.',
          'Colloquial analysis confirms natural speech patterns: contractions, sentence fragments, and emotional emphasis that follow authentic North American discourse norms.',
          'The content demonstrates vulnerability and self-deprecating humor—emotional patterns that AI systems consistently struggle to produce without seeming performative.',
          'Strong first-person narrative authenticity. The specific, idiosyncratic details and emotional trajectory are consistent with genuine human recollection rather than synthetic generation.',
        ],
      },
    },
    'South_America': {
      biasToward: 'human',
      strengthRange: [0.50, 0.84],
      focusAreas: ['cultural vibrancy', 'emotional depth', 'community voice'],
      reasoningTemplates: {
        ai: [
          'The content lacks the passionate cadence and cultural specificity characteristic of authentic South American expression. Emotional peaks feel manufactured rather than organic.',
          'Structural analysis reveals template-driven composition. Authentic voices from this region typically weave personal anecdote with broader social commentary in less predictable patterns.',
          'The narrative fails to capture the communal storytelling tradition—missing the layered, multi-generational perspectives that define authentic regional discourse.',
          'Cross-cultural analysis flags uniform paragraph density and lack of code-switching or bilingual markers common in authentic South American writing.',
        ],
        human: [
          'Strong cultural authenticity indicators: passionate voice, community-embedded references, and the emotional intensity that characterizes genuine South American expression.',
          'The content displays authentic lived-experience markers—personal stakes, cultural pride, and spontaneous emotional shifts that resist algorithmic generation.',
          'Narrative patterns align with regional storytelling traditions: weaving personal experience with broader social themes in an organic, non-formulaic structure.',
          'The author demonstrates deep cultural knowledge through implicit references and community-specific idioms that current AI systems struggle to authentically reproduce.',
        ],
      },
    },
    'Antarctica': {
      biasToward: 'ai',
      strengthRange: [0.52, 0.78],
      focusAreas: ['scientific rigor', 'data precision', 'environmental accuracy'],
      reasoningTemplates: {
        ai: [
          'The scientific precision and uniform data density suggest algorithmic generation. Authentic field research reports typically include more uncertainty qualifiers and contextual observations.',
          'Pattern analysis reveals systematic information organization exceeding natural human cognitive structuring. The content reads like a well-optimized synthesis rather than original field notes.',
          'Environmental context markers lack the situated, experiential quality typical of researchers who have actually worked in extreme polar conditions.',
          'Statistical claims are presented with suspiciously narrow confidence intervals. Authentic Antarctic research acknowledges the inherent measurement challenges of polar environments.',
        ],
        human: [
          'The content exhibits genuine field-research markers: awareness of harsh conditions, practical measurement limitations, and the experiential insights that come from polar fieldwork.',
          'Scientific discourse shows authentic expert engagement: appropriate uncertainty, methodological self-awareness, and the kind of nuanced observation that AI synthesis typically flattens.',
          'Environmental observations include the granular, condition-specific details that distinguish genuine Antarctic field experience from desk-based compilation.',
          'The author demonstrates hands-on knowledge through practical asides and environmental commentary that go beyond what data synthesis alone would produce.',
        ],
      },
    },
    'Australia': {
      biasToward: 'ai',
      strengthRange: [0.52, 0.82],
      focusAreas: ['environmental context', 'data integrity', 'cross-modal consistency'],
      reasoningTemplates: {
        ai: [
          'Data integrity analysis flags suspiciously precise statistical claims without appropriate uncertainty ranges. The content reads as a polished synthesis rather than original analysis.',
          'Cross-referencing environmental context markers: the content lacks the localized knowledge and situated perspective that human experts typically embed in their analysis.',
          'Pattern recognition identifies systematic information organization that exceeds natural human cognitive structuring capabilities. Likely outline-driven generation.',
          'The content demonstrates broad surface-level coverage without the deep, specialized insights that come from hands-on expertise. Consistent with retrieval-augmented generation.',
        ],
        human: [
          'Environmental context analysis confirms situated knowledge: the author demonstrates awareness of local conditions and practical constraints that pure data synthesis would miss.',
          'Data presentation follows the natural human pattern of leading with experience and supporting with numbers, rather than the reverse pattern common in AI generation.',
          'Cross-modal analysis detects genuine expertise markers: appropriate use of technical jargon mixed with practical observations that suggest hands-on experience.',
          'The content shows authentic engagement with uncertainty—acknowledging limitations and expressing professional judgment rather than algorithmic confidence.',
        ],
      },
    },
  };

  // ─── Public Methods ───

  /** Start a new survey session using only curated dataset content. */
  async startSession(collabMode: boolean = false): Promise<void> {
    this._loading.set(true);
    const itemCount = this.CONTINENTS.length * 2;

    let rawItems: Omit<SurveyItem, 'id' | 'agentVerdicts'>[];

    // Set a timeout warning if content fetch takes too long
    const timeoutId = setTimeout(() => {
      if (this._loading()) {
        this.errorService.contentTimeout();
      }
    }, 15000);

    try {
      const datasetHealth = await this.api.getDatasetHealth();
      if (!datasetHealth) {
        throw new Error('Dataset health check unavailable');
      }
      if (!datasetHealth.dataset.ready) {
        const issues = datasetHealth.dataset.issues.slice(0, 3).join('; ');
        throw new Error(issues || 'Dataset does not satisfy the balanced session contract');
      }

      const fetched = await this.api.fetchContent(itemCount);
      if (!fetched || fetched.length === 0) {
        throw new Error('Empty response from content API');
      }

      rawItems = fetched.map(f => ({
        title: f.title,
        content: f.content,
        imageUrl: f.imageUrl || undefined,
        videoUrl: f.videoUrl || undefined,
        contentType: f.contentType,
        groundTruth: f.groundTruth,
        category: f.category,
        difficulty: f.difficulty,
        source: f.source,
        continent: f.continent,
      }));
      console.log(`Loaded ${rawItems.length} dataset items from: ${[...new Set(fetched.map(f => f.source))].join(', ')}`);
    } catch (err) {
      console.error('Dataset content fetch failed:', err);
      const detail = err instanceof Error ? err.message : undefined;
      this.errorService.contentLoadFailed(detail ? `Dataset readiness check failed: ${detail}.` : undefined);
      this._session.set(null);
      this._results.set(null);
      this._loading.set(false);
      clearTimeout(timeoutId);
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    const items: SurveyItem[] = rawItems.map((raw, i) => ({
      ...raw,
      id: `survey-${Date.now()}-${i}`,
      agentVerdicts: this.generateUniqueAgentVerdicts(raw),
    }));

    const session: SurveySession = {
      id: `session-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      startedAt: new Date(),
      items,
      currentIndex: 0,
      collabMode,
    };

    this._session.set(session);
    this._results.set(null);
    this._loading.set(false);

    // Persist anonymous session to MySQL (no PII)
    this.api.createSession(session.id, session.startedAt, collabMode, items.length);
  }

  /** Submit human verdict for current item and advance. */
  submitVerdict(
    verdict: 'ai' | 'human',
    confidence: number,
    reasoning: string,
    meta: { responseTimeMs: number; flaggedFast: boolean } = { responseTimeMs: 0, flaggedFast: false }
  ): void {
    const s = this._session();
    if (!s || s.completedAt) return;

    const updatedItems = [...s.items];
    updatedItems[s.currentIndex] = {
      ...updatedItems[s.currentIndex],
      humanVerdict: verdict,
      humanConfidence: confidence,
      humanReasoning: reasoning,
    };

    const nextIndex = s.currentIndex + 1;
    const isLast = nextIndex >= s.items.length;

    this._session.set({
      ...s,
      items: updatedItems,
      currentIndex: isLast ? s.currentIndex : nextIndex,
      completedAt: isLast ? new Date() : undefined,
    });

    // Persist response to MySQL (no PII) — includes response time metadata
    this.api.saveResponse(s.id, updatedItems[s.currentIndex], s.currentIndex, meta);

    if (isLast) {
      this.computeResults();
    }
  }

  /** Navigate to specific item (for review). */
  goToItem(index: number): void {
    const s = this._session();
    if (!s || index < 0 || index >= s.items.length) return;
    this._session.set({ ...s, currentIndex: index });
  }

  // ─── Private Methods ───

  private buildAgentAnalysisMedia(item: Pick<SurveyItem, 'contentType' | 'imageUrl' | 'videoUrl'>): Pick<AgentVerdict, 'analysisImageUrl' | 'analysisVideoUrl' | 'analysisMediaType'> {
    if (item.contentType === 'video') {
      if (item.videoUrl) {
        return {
          analysisImageUrl: item.imageUrl,
          analysisVideoUrl: item.videoUrl,
          analysisMediaType: 'video',
        };
      }
      if (item.imageUrl) {
        return {
          analysisImageUrl: item.imageUrl,
          analysisMediaType: 'image',
        };
      }
      return {};
    }

    if (item.contentType === 'image' && item.imageUrl) {
      return {
        analysisImageUrl: item.imageUrl,
        analysisMediaType: 'image',
      };
    }

    return {};
  }

  private generateUniqueAgentVerdicts(item: Omit<SurveyItem, 'id' | 'agentVerdicts'>): AgentVerdict[] {
    const media = this.buildAgentAnalysisMedia(item);

    return this.CONTINENTS.map(region => {
      const personality = this.agentPersonalities[region];

      // Determine this agent's verdict based on bias + difficulty + randomness
      const correctProbability = this.getCorrectProbability(personality.biasToward, item.groundTruth, item.difficulty);
      const isCorrect = Math.random() < correctProbability;
      const verdict: 'ai' | 'human' = isCorrect ? item.groundTruth : (item.groundTruth === 'ai' ? 'human' : 'ai');

      // Confidence varies by difficulty and agent strength
      const [minStr, maxStr] = personality.strengthRange;
      const difficultyPenalty = item.difficulty === 'hard' ? 0.15 : item.difficulty === 'medium' ? 0.07 : 0;
      const confidence = Math.max(0.3, Math.min(1, minStr + Math.random() * (maxStr - minStr) - difficultyPenalty));

      // Pick a unique reasoning template
      const templates = personality.reasoningTemplates[verdict];
      const reasoning = templates[Math.floor(Math.random() * templates.length)];

      return {
        agentName: `${region} Bias Agent`,
        region,
        verdict,
        confidence: Math.round(confidence * 100) / 100,
        reasoning,
        ...media,
      };
    });
  }

  private getCorrectProbability(
    bias: 'ai' | 'human' | 'neutral',
    truth: 'ai' | 'human',
    difficulty: 'easy' | 'medium' | 'hard'
  ): number {
    let base = difficulty === 'easy' ? 0.85 : difficulty === 'medium' ? 0.70 : 0.55;

    // Bias effect: agents biased toward a label are more likely to say that label
    if (bias === 'ai') {
      base += truth === 'ai' ? 0.08 : -0.08;
    } else if (bias === 'human') {
      base += truth === 'human' ? 0.08 : -0.08;
    }

    return Math.max(0.35, Math.min(0.95, base + (Math.random() * 0.1 - 0.05)));
  }

  private computeResults(): void {
    const s = this._session();
    if (!s) return;

    const items = s.items;
    const totalItems = items.length;

    // Human results
    const humanCorrect = items.filter(i => i.humanVerdict === i.groundTruth).length;
    const humanAiCount = items.filter(i => i.humanVerdict === 'ai').length;

    // Agent results per continent
    const agentResults: AgentResult[] = this.CONTINENTS.map(region => {
      const correct = items.filter(i => {
        const av = i.agentVerdicts.find(v => v.region === region);
        return av && av.verdict === i.groundTruth;
      }).length;

      const aiCount = items.filter(i => {
        const av = i.agentVerdicts.find(v => v.region === region);
        return av && av.verdict === 'ai';
      }).length;

      const avgConf = items.reduce((sum, i) => {
        const av = i.agentVerdicts.find(v => v.region === region);
        return sum + (av?.confidence ?? 0);
      }, 0) / totalItems;

      return {
        region,
        correct,
        accuracy: Math.round((correct / totalItems) * 100) / 100,
        aiCount,
        humanCount: totalItems - aiCount,
        avgConfidence: Math.round(avgConf * 100) / 100,
      };
    });

    // Agreement matrix
    const agreementMatrix = this.CONTINENTS.map(region => {
      const agreements = items.filter(i => {
        const av = i.agentVerdicts.find(v => v.region === region);
        return av && av.verdict === i.humanVerdict;
      }).length;
      return { region, agreementRate: Math.round((agreements / totalItems) * 100) / 100 };
    });

    const results: SurveyResults = {
      sessionId: s.id,
      totalItems,
      humanCorrect,
      humanAccuracy: Math.round((humanCorrect / totalItems) * 100) / 100,
      humanAiCount,
      humanHumanCount: totalItems - humanAiCount,
      agentResults,
      actualAiCount: items.filter(i => i.groundTruth === 'ai').length,
      actualHumanCount: items.filter(i => i.groundTruth === 'human').length,
      collabMode: s.collabMode,
      agreementMatrix,
    };

    this._results.set(results);
    this._allResults.update(arr => [...arr, results]);

    // ─── Attention Check Audit ───
    const attentionResult = this.checkAttentionChecks(items);
    if (attentionResult.total > 0) {
      if (!attentionResult.passed) {
        console.warn(`ATTENTION CHECK FAILED — Session ${s.id}: ${attentionResult.correct}/${attentionResult.total} passed`);
      } else {
        console.log(`Attention check passed — Session ${s.id}: ${attentionResult.correct}/${attentionResult.total}`);
      }
    }

    // Persist completed results to MySQL (no PII)
    this.api.completeSession(results);
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

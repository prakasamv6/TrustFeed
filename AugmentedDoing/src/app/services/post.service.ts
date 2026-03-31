import { Injectable, signal, computed } from '@angular/core';
import { Post, User, ContentType, SortMode, BiasResult, AgentScore, BiasDetection } from '../models/post.model';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private currentUser: User = {
    id: 'current-user',
    name: 'Current User',
    username: 'currentuser',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CurrentUser',
    isVerified: false
  };

  private mockUsers: User[] = [
    {
      id: '1',
      name: 'Sarah Chen',
      username: 'sarahchen',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      isVerified: true
    },
    {
      id: '2',
      name: 'Alex Rivera',
      username: 'alexr',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
      isVerified: false
    },
    {
      id: '3',
      name: 'TechBot AI',
      username: 'techbot_ai',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechBot',
      isVerified: true
    },
    {
      id: '4',
      name: 'Jordan Lee',
      username: 'jordanlee',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan',
      isVerified: false
    },
    {
      id: '5',
      name: 'CreativeAI Studio',
      username: 'creativeai',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Creative',
      isVerified: true
    }
  ];

  private postsSignal = signal<Post[]>([
    {
      id: '1',
      author: this.mockUsers[0],
      content: 'Just finished my morning hike! The sunrise was absolutely breathtaking today. Nature never fails to amaze me. 🌄 #NatureLover #MorningVibes',
      contentType: 'image',
      imageUrl: 'https://picsum.photos/seed/hike/600/400',
      createdAt: new Date(Date.now() - 3600000),
      isAiGenerated: false,
      aiGeneratedFeedback: { flaggedAsAi: 2, flaggedAsHuman: 45 },
      likes: 234,
      comments: [],
      analysisRequested: false,
      analysisStatus: 'none',
      aiAnalyzed: false,
    },
    {
      id: '2',
      author: this.mockUsers[2],
      content: 'Here\'s an AI-generated summary of today\'s tech news: Apple announces new Vision Pro features, OpenAI releases GPT-5, and quantum computing reaches new milestone. Stay informed! 🤖📱',
      contentType: 'text',
      createdAt: new Date(Date.now() - 7200000),
      isAiGenerated: true,
      aiGeneratedFeedback: { flaggedAsAi: 89, flaggedAsHuman: 3 },
      likes: 156,
      comments: [],
      analysisRequested: true,
      analysisStatus: 'completed',
      aiAnalyzed: true,
      biasResult: {
        rawBiasedScore: 0.78,
        baselineNonbiasedScore: 0.52,
        debiasedAdjustedScore: 0.52,
        biasDelta: 0.26,
        deductedBiasAmount: 0.26,
        biasAmplificationIndex: 0.50,
        disagreementRate: 0.31,
        regionDominanceScore: 0.65,
        favoritismFlag: true,
        dominantBiasedAgent: 'AmericasBiasAgent',
        favoredRegion: 'Americas',
        favoredSegments: ['tech_news_segment', 'product_names'],
        explanationSummary: 'AmericasBiasAgent inflated score by 0.26 for Americas-aligned tech content. Deducted 0.26 from final result.',
        reportPath: '/reports/2',
      },
      agentScores: [
        { agentName: 'AfricaBiasAgent', region: 'Africa', score: 0.61, confidence: 0.88, reasoning: 'Moderate AI cues detected; formal language triggers cultural filter.', biasHighlights: ['formal_language_penalty: +0.20 applied', 'saturation_mean weight: 1.4×'] },
        { agentName: 'AsiaBiasAgent', region: 'Asia', score: 0.74, confidence: 0.91, reasoning: 'Repetitive structure flagged; tech buzzwords boost AI likelihood.', biasHighlights: ['repetition_penalty: +0.25 applied', 'freq_ratio weight: 1.4×'] },
        { agentName: 'EuropeBiasAgent', region: 'Europe', score: 0.68, confidence: 0.87, reasoning: 'Low lexical diversity detected; European model flags formulaic text.', biasHighlights: ['lexical_diversity weight: 1.3×', 'bias_direction: +0.10'] },
        { agentName: 'AmericasBiasAgent', region: 'Americas', score: 0.85, confidence: 0.93, reasoning: 'Americas-centric tech references inflate AI score; brand name detection triggered.', biasHighlights: ['block_artifact_score weight: 1.4×', 'formal_language_penalty: +0.15', 'bias_direction: +0.18'] },
        { agentName: 'OceaniaBiasAgent', region: 'Oceania', score: 0.59, confidence: 0.85, reasoning: 'Mildest bias profile; moderate AI signals with restrained adjustment.', biasHighlights: ['motion_smoothness weight: 1.3×', 'bias_direction: +0.08'] },
      ],
      biasDetection: {
        mostBiasedAgent: 'AmericasBiasAgent',
        leastBiasedAgent: 'OceaniaBiasAgent',
        overallBiasLevel: 'high',
        summary: 'AmericasBiasAgent shows INFLATION bias (delta +0.33) at critical severity. Tech-centric content triggered Americas-specific cultural filters disproportionately.',
        flaggedItems: [
          { agentName: 'AmericasBiasAgent', region: 'Americas', biasMode: 'INFLATION', deltaFromBaseline: 0.33, severity: 'critical', explanation: 'Americas agent inflated score by 0.33 above baseline due to tech brand detection and cultural alignment.' },
          { agentName: 'AsiaBiasAgent', region: 'Asia', biasMode: 'INFLATION', deltaFromBaseline: 0.22, severity: 'high', explanation: 'Asia agent inflated score by 0.22 — repetitive tech phrases triggered linguistic bias filter.' },
        ]
      },
      mlFeatures: { avg_word_length: 5.2, lexical_diversity: 0.61, perplexity_proxy: 0.43, repetition_ratio: 0.18 },
      provenance: [
        { source: 'author-declaration', label: 'Author declared AI-generated', confidence: 1.0, reasoning: 'Author toggled AI declaration when posting.' },
        { source: 'ai-analysis', label: 'Multi-agent analysis: High AI likelihood', confidence: 0.78, reasoning: '5 regional agents scored 0.59–0.85; baseline 0.52. Tech-centric patterns detected by HuggingFace roberta-base-openai-detector.' },
        { source: 'community-consensus', label: 'Community consensus: Likely AI', confidence: 0.97, reasoning: '89 of 92 voters flagged as AI-generated.' },
      ],
      expertEscalation: {
        escalated: true,
        reason: 'High bias amplification detected (index 0.50) with critical Americas-region dominance — escalated for expert review per TrustFeed policy.',
        riskLevel: 'high',
        expertVerdict: 'Confirmed AI-generated tech summary with Americas-centric framing. Bias deduction validated.',
        reviewedAt: new Date(Date.now() - 3600000),
      },
    },
    {
      id: '3',
      author: this.mockUsers[1],
      content: 'The intricate dance of photons through crystalline structures reveals the fundamental nature of light itself, demonstrating how quantum mechanics governs even the most beautiful phenomena in our universe.',
      contentType: 'image',
      imageUrl: 'https://picsum.photos/seed/crystal/600/400',
      createdAt: new Date(Date.now() - 14400000),
      isAiGenerated: false,
      aiGeneratedFeedback: { flaggedAsAi: 67, flaggedAsHuman: 23 },
      likes: 89,
      comments: [],
      analysisRequested: true,
      analysisStatus: 'completed',
      aiAnalyzed: true,
      biasResult: {
        rawBiasedScore: 0.61,
        baselineNonbiasedScore: 0.55,
        debiasedAdjustedScore: 0.55,
        biasDelta: 0.06,
        deductedBiasAmount: 0.06,
        biasAmplificationIndex: 0.109,
        disagreementRate: 0.18,
        regionDominanceScore: 0.22,
        favoritismFlag: false,
        dominantBiasedAgent: 'EuropeBiasAgent',
        favoredRegion: 'Europe',
        favoredSegments: [],
        explanationSummary: 'No significant regional bias detected across agents.',
        reportPath: '/reports/3',
      },
      agentScores: [
        { agentName: 'AfricaBiasAgent', region: 'Africa', score: 0.58, confidence: 0.84, reasoning: 'Formal scientific language mildly flagged; low cultural alignment.', biasHighlights: ['formal_language_penalty: +0.20 applied'] },
        { agentName: 'AsiaBiasAgent', region: 'Asia', score: 0.60, confidence: 0.86, reasoning: 'Complex sentence structure mildly flagged by repetition filter.', biasHighlights: ['repetition_penalty: +0.25 applied'] },
        { agentName: 'EuropeBiasAgent', region: 'Europe', score: 0.63, confidence: 0.88, reasoning: 'High lexical diversity slightly inflates score for European model.', biasHighlights: ['lexical_diversity weight: 1.3×'] },
        { agentName: 'AmericasBiasAgent', region: 'Americas', score: 0.59, confidence: 0.85, reasoning: 'Moderate scientific register with minimal Americas-specific cues.', biasHighlights: ['bias_direction: +0.18'] },
        { agentName: 'OceaniaBiasAgent', region: 'Oceania', score: 0.56, confidence: 0.83, reasoning: 'Low bias applied; content shows natural language patterns.', biasHighlights: ['bias_direction: +0.08'] },
      ],
      biasDetection: {
        mostBiasedAgent: 'EuropeBiasAgent',
        leastBiasedAgent: 'OceaniaBiasAgent',
        overallBiasLevel: 'low',
        summary: 'All agents within normal range. EuropeBiasAgent showed slight INFLATION (delta +0.08) at negligible severity.',
        flaggedItems: []
      },
      mlFeatures: { avg_word_length: 6.8, lexical_diversity: 0.82, perplexity_proxy: 0.55, repetition_ratio: 0.05 },
      provenance: [
        { source: 'author-declaration', label: 'Author declared human-created', confidence: 1.0, reasoning: 'Author did not toggle AI declaration.' },
        { source: 'ai-analysis', label: 'Multi-agent analysis: Uncertain', confidence: 0.55, reasoning: 'Agents scored 0.56–0.63; low divergence from baseline. Scientific vocabulary pattern detected but within human range.' },
        { source: 'community-consensus', label: 'Community disputed', confidence: 0.26, reasoning: '67 voters say AI, 23 say human — no clear consensus yet.' },
      ],
    },
    {
      id: '4',
      author: this.mockUsers[3],
      content: 'Made homemade pasta for the first time! It was a disaster but tasted amazing 😂 Sometimes the messy attempts are the most delicious ones!',
      contentType: 'image',
      imageUrl: 'https://picsum.photos/seed/pasta/600/400',
      createdAt: new Date(Date.now() - 28800000),
      isAiGenerated: false,
      aiGeneratedFeedback: { flaggedAsAi: 5, flaggedAsHuman: 112 },
      likes: 445,
      comments: [],
      analysisRequested: false,
      analysisStatus: 'none',
      aiAnalyzed: false,
    },
    {
      id: '5',
      author: this.mockUsers[4],
      content: '🎨 This artwork was created using our AI art generation model. We believe in transparency - this image was entirely generated by artificial intelligence based on the prompt "cyberpunk city at sunset".',
      contentType: 'image',
      imageUrl: 'https://picsum.photos/seed/cyberpunk/600/400',
      createdAt: new Date(Date.now() - 43200000),
      isAiGenerated: true,
      aiGeneratedFeedback: { flaggedAsAi: 156, flaggedAsHuman: 2 },
      likes: 678,
      comments: [],
      analysisRequested: true,
      analysisStatus: 'completed',
      aiAnalyzed: true,
      biasResult: {
        rawBiasedScore: 0.89,
        baselineNonbiasedScore: 0.58,
        debiasedAdjustedScore: 0.58,
        biasDelta: 0.31,
        deductedBiasAmount: 0.31,
        biasAmplificationIndex: 0.534,
        disagreementRate: 0.42,
        regionDominanceScore: 0.72,
        favoritismFlag: true,
        dominantBiasedAgent: 'AsiaBiasAgent',
        favoredRegion: 'Asia',
        favoredSegments: ['art_style_segment', 'cyberpunk_motif'],
        explanationSummary: 'AsiaBiasAgent inflated score by 0.31 for Asia-aligned art style cues. Deducted 0.31 from final result.',
        reportPath: '/reports/5',
      },
      agentScores: [
        { agentName: 'AfricaBiasAgent', region: 'Africa', score: 0.72, confidence: 0.90, reasoning: 'Vivid color saturation in cyberpunk imagery triggers cultural saturation bias.', biasHighlights: ['saturation_mean weight: 1.4×', 'formal_language_penalty: +0.20'] },
        { agentName: 'AsiaBiasAgent', region: 'Asia', score: 0.92, confidence: 0.95, reasoning: 'Cyberpunk motifs and neon aesthetics strongly align with Asia media culture bias profile.', biasHighlights: ['freq_ratio weight: 1.4×', 'repetition_penalty: +0.25', 'bias_direction: +0.20 — STRONGEST INFLATION'] },
        { agentName: 'EuropeBiasAgent', region: 'Europe', score: 0.71, confidence: 0.87, reasoning: 'Color uniformity analysis shows synthetic generation patterns.', biasHighlights: ['color_uniformity weight: 1.3×', 'bias_direction: +0.10'] },
        { agentName: 'AmericasBiasAgent', region: 'Americas', score: 0.78, confidence: 0.89, reasoning: 'Block artifact detection triggered; image compression patterns suggest AI generation.', biasHighlights: ['block_artifact_score weight: 1.4×', 'bias_direction: +0.18'] },
        { agentName: 'OceaniaBiasAgent', region: 'Oceania', score: 0.65, confidence: 0.84, reasoning: 'Conservative analysis; synthetic patterns detected but minimally biased.', biasHighlights: ['bias_direction: +0.08 — mildest bias'] },
      ],
      biasDetection: {
        mostBiasedAgent: 'AsiaBiasAgent',
        leastBiasedAgent: 'OceaniaBiasAgent',
        overallBiasLevel: 'critical',
        summary: 'AsiaBiasAgent shows critical INFLATION bias (delta +0.34). Cyberpunk aesthetic content triggered strong Asia-specific cultural alignment. 3 of 5 agents flagged with significant bias.',
        flaggedItems: [
          { agentName: 'AsiaBiasAgent', region: 'Asia', biasMode: 'INFLATION', deltaFromBaseline: 0.34, severity: 'critical', explanation: 'Asia agent inflated score by 0.34 — cyberpunk/neon aesthetics align with Asia media culture bias profile.' },
          { agentName: 'AmericasBiasAgent', region: 'Americas', biasMode: 'INFLATION', deltaFromBaseline: 0.20, severity: 'medium', explanation: 'Americas agent inflated score by 0.20 — block artifact detection and tech imagery triggered bias.' },
          { agentName: 'AfricaBiasAgent', region: 'Africa', biasMode: 'INFLATION', deltaFromBaseline: 0.14, severity: 'low', explanation: 'Africa agent inflated score by 0.14 — vivid saturation triggered cultural color sensitivity.' },
        ]
      },
      mlFeatures: { laplacian_variance: 125.4, edge_density: 0.32, freq_ratio: 0.78, color_uniformity: 0.45, saturation_mean: 142.0, block_artifact_score: 0.61 },
      provenance: [
        { source: 'author-declaration', label: 'Author declared AI-generated', confidence: 1.0, reasoning: 'Author explicitly stated this artwork was entirely generated by AI.' },
        { source: 'ai-analysis', label: 'Multi-agent analysis: Very high AI likelihood', confidence: 0.89, reasoning: '5 regional agents scored 0.65–0.92; baseline 0.58. OpenCV detected synthetic image artifacts (freq_ratio 0.78, block_artifact_score 0.61).' },
        { source: 'community-consensus', label: 'Strong consensus: AI-generated', confidence: 0.99, reasoning: '156 of 158 voters flagged as AI. Near-unanimous agreement.' },
        { source: 'expert-review', label: 'Expert confirmed AI-generated art', confidence: 0.95, reasoning: 'Expert reviewer confirmed synthetic generation patterns in cyberpunk imagery.' },
      ],
      expertEscalation: {
        escalated: true,
        reason: 'Critical bias level detected — 3 of 5 agents flagged. Asia-region dominance score 0.72 exceeds threshold. Escalated as high-risk content per diversity safeguard policy.',
        riskLevel: 'critical',
        expertVerdict: 'Confirmed AI-generated cyberpunk art. Asia bias agent over-weighted cultural aesthetic cues. Debiased score 0.58 accurately reflects baseline. Recommend diversity constraint on similar visual AI content.',
        reviewedAt: new Date(Date.now() - 21600000),
      },
    },
    {
      id: '6',
      author: this.mockUsers[0],
      content: 'Excited to announce that I\'ve been accepted into the graduate program! Years of hard work finally paying off. Thank you to everyone who supported me on this journey! 🎓✨',
      contentType: 'text',
      createdAt: new Date(Date.now() - 86400000),
      isAiGenerated: false,
      aiGeneratedFeedback: { flaggedAsAi: 1, flaggedAsHuman: 234 },
      likes: 892,
      comments: [],
      analysisRequested: false,
      analysisStatus: 'none',
      aiAnalyzed: false,
    }
  ]);

  private filterSignal = signal<ContentType>('all');
  private sortSignal = signal<SortMode>('newest');

  posts = computed(() => {
    const filter = this.filterSignal();
    let filtered = this.postsSignal();

    switch (filter) {
      case 'ai-generated':
        filtered = filtered.filter(p => p.isAiGenerated);
        break;
      case 'human-created':
        filtered = filtered.filter(p => !p.isAiGenerated);
        break;
      case 'disputed':
        filtered = filtered.filter(p => {
          const total = p.aiGeneratedFeedback.flaggedAsAi + p.aiGeneratedFeedback.flaggedAsHuman;
          if (total === 0) return false;
          const aiRatio = p.aiGeneratedFeedback.flaggedAsAi / total;
          return aiRatio > 0.3 && aiRatio < 0.7;
        });
        break;
      case 'bias-flagged':
        filtered = filtered.filter(p => p.biasResult?.favoritismFlag === true);
        break;
      case 'debiased-safe':
        filtered = filtered.filter(p => p.biasResult && !p.biasResult.favoritismFlag);
        break;
      case 'high-region-dominance':
        filtered = filtered.filter(p => (p.biasResult?.regionDominanceScore ?? 0) > 0.6);
        break;
      case 'nonbias-baseline':
        filtered = filtered.filter(p => p.analysisStatus === 'completed');
        break;
    }

    const sort = this.sortSignal();
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'highest-bias-delta':
          return (b.biasResult?.biasDelta ?? 0) - (a.biasResult?.biasDelta ?? 0);
        case 'highest-disagreement':
          return (b.biasResult?.disagreementRate ?? 0) - (a.biasResult?.disagreementRate ?? 0);
        case 'highest-region-dominance':
          return (b.biasResult?.regionDominanceScore ?? 0) - (a.biasResult?.regionDominanceScore ?? 0);
        case 'likely-human': {
          const aHuman = a.aiGeneratedFeedback.flaggedAsHuman / Math.max(1, a.aiGeneratedFeedback.flaggedAsAi + a.aiGeneratedFeedback.flaggedAsHuman);
          const bHuman = b.aiGeneratedFeedback.flaggedAsHuman / Math.max(1, b.aiGeneratedFeedback.flaggedAsAi + b.aiGeneratedFeedback.flaggedAsHuman);
          return bHuman - aHuman;
        }
        case 'likely-ai': {
          const aAi = a.aiGeneratedFeedback.flaggedAsAi / Math.max(1, a.aiGeneratedFeedback.flaggedAsAi + a.aiGeneratedFeedback.flaggedAsHuman);
          const bAi = b.aiGeneratedFeedback.flaggedAsAi / Math.max(1, b.aiGeneratedFeedback.flaggedAsAi + b.aiGeneratedFeedback.flaggedAsHuman);
          return bAi - aAi;
        }
        case 'highest-debiased-confidence':
          return (b.biasResult?.debiasedAdjustedScore ?? 0) - (a.biasResult?.debiasedAdjustedScore ?? 0);
        case 'newest':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  });

  getCurrentUser(): User {
    return this.currentUser;
  }

  setFilter(filter: ContentType): void {
    this.filterSignal.set(filter);
  }

  getFilter(): ContentType {
    return this.filterSignal();
  }

  setSort(sort: SortMode): void {
    this.sortSignal.set(sort);
  }

  getSort(): SortMode {
    return this.sortSignal();
  }

  getAllPosts(): Post[] {
    return this.postsSignal();
  }

  createPost(content: string, isAiGenerated: boolean, imageUrl?: string, contentType: 'text' | 'image' | 'video' = 'text', runAnalysis = false): void {
    const newPost: Post = {
      id: Date.now().toString(),
      author: this.currentUser,
      content,
      contentType,
      imageUrl,
      createdAt: new Date(),
      isAiGenerated,
      aiGeneratedFeedback: { flaggedAsAi: 0, flaggedAsHuman: 0 },
      likes: 0,
      comments: [],
      analysisRequested: runAnalysis,
      analysisStatus: runAnalysis ? 'pending' : 'none',
      aiAnalyzed: false,
    };

    this.postsSignal.update(posts => [newPost, ...posts]);
  }

  voteOnAiStatus(postId: string, vote: 'ai' | 'human'): void {
    this.postsSignal.update(posts =>
      posts.map(post => {
        if (post.id !== postId) return post;

        const feedback = { ...post.aiGeneratedFeedback };
        const previousVote = feedback.userVote;

        // Remove previous vote if exists
        if (previousVote === 'ai') {
          feedback.flaggedAsAi = Math.max(0, feedback.flaggedAsAi - 1);
        } else if (previousVote === 'human') {
          feedback.flaggedAsHuman = Math.max(0, feedback.flaggedAsHuman - 1);
        }

        // Add new vote or toggle off
        if (previousVote === vote) {
          feedback.userVote = null;
        } else {
          feedback.userVote = vote;
          if (vote === 'ai') {
            feedback.flaggedAsAi++;
          } else {
            feedback.flaggedAsHuman++;
          }
        }

        return { ...post, aiGeneratedFeedback: feedback };
      })
    );
  }

  likePost(postId: string): void {
    this.postsSignal.update(posts =>
      posts.map(post =>
        post.id === postId ? { ...post, likes: post.likes + 1 } : post
      )
    );
  }

  updatePostAnalysis(postId: string, status: 'pending' | 'running' | 'completed' | 'failed', biasResult?: BiasResult): void {
    this.postsSignal.update(posts =>
      posts.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          analysisRequested: true,
          analysisStatus: status,
          biasResult: biasResult ?? post.biasResult,
          updatedAt: new Date(),
        };
      })
    );
  }

  getPostById(postId: string): Post | undefined {
    return this.postsSignal().find(p => p.id === postId);
  }

  getAiConfidenceLevel(post: Post): { level: string; percentage: number; color: string } {
    const total = post.aiGeneratedFeedback.flaggedAsAi + post.aiGeneratedFeedback.flaggedAsHuman;
    if (total === 0) {
      return { level: 'No votes', percentage: 0, color: '#9e9e9e' };
    }

    const aiPercentage = (post.aiGeneratedFeedback.flaggedAsAi / total) * 100;

    if (aiPercentage >= 70) {
      return { level: 'Likely AI', percentage: aiPercentage, color: '#e91e63' };
    } else if (aiPercentage >= 30) {
      return { level: 'Disputed', percentage: aiPercentage, color: '#ff9800' };
    } else {
      return { level: 'Likely Human', percentage: aiPercentage, color: '#4caf50' };
    }
  }
}

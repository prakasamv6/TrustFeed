import { Injectable, signal } from '@angular/core';

export interface ContentAnalysis {
  aiInfluenceScore: number; // 0-100 weightage
  aiPatternPercentage: number; // % of AI patterns detected
  citationAnalysis: {
    totalClaims: number;
    citedClaims: number;
    uncitedClaims: number;
    citationScore: number; // 0-100
  };
  patterns: {
    category: string;
    detected: boolean;
    weight: number;
    description: string;
  }[];
}

export interface ReviewSubmission {
  id: string;
  content: string;
  source: 'linkedin' | 'news' | 'twitter' | 'other';
  sourceUrl?: string;
  submittedAt: Date;
  submittedBy: string;
  declaredAsAi: boolean; // User declared this content as AI-generated
  declaredAt?: Date;
  votes: {
    ai: number;
    human: number;
    userVote?: 'ai' | 'human' | null;
  };
  aiIndicators: string[];
  humanIndicators: string[];
  analysis: ContentAnalysis;
}

@Injectable({
  providedIn: 'root'
})
export class ContentReviewService {
  private submissionsSignal = signal<ReviewSubmission[]>([
    {
      id: '1',
      content: `Excited to share that after 15 years in the industry, I've learned that success isn't about the destination—it's about the journey. Every setback is a setup for a comeback. Every challenge is an opportunity in disguise. Remember: your network is your net worth, and authenticity is the key to building meaningful connections. What's the most valuable lesson you've learned in your career? Drop it in the comments below! 👇 #Leadership #Success #Mindset #CareerAdvice`,
      source: 'linkedin',
      sourceUrl: 'https://linkedin.com/post/example1',
      submittedAt: new Date(Date.now() - 7200000),
      submittedBy: 'Anonymous User',
      declaredAsAi: true,
      declaredAt: new Date(Date.now() - 3600000),
      votes: { ai: 145, human: 23 },
      aiIndicators: [
        'Generic motivational phrases',
        'Engagement bait ("Drop in comments")',
        'Excessive hashtags',
        'Formulaic structure'
      ],
      humanIndicators: [
        'Specific time reference (15 years)',
        'Personal career context'
      ],
      analysis: {
        aiInfluenceScore: 78,
        aiPatternPercentage: 72,
        citationAnalysis: {
          totalClaims: 4,
          citedClaims: 0,
          uncitedClaims: 4,
          citationScore: 0
        },
        patterns: [
          { category: 'Motivational Clichés', detected: true, weight: 25, description: 'Generic inspirational phrases commonly used by AI' },
          { category: 'Engagement Bait', detected: true, weight: 20, description: 'Call-to-action designed to boost engagement' },
          { category: 'Hashtag Stuffing', detected: true, weight: 15, description: 'Excessive use of trending hashtags' },
          { category: 'Formulaic Structure', detected: true, weight: 12, description: 'Predictable post format' },
          { category: 'Personal Anecdote', detected: false, weight: -10, description: 'Specific personal story' },
          { category: 'Unique Voice', detected: false, weight: -15, description: 'Distinctive writing style' }
        ]
      }
    },
    {
      id: '2',
      content: `Just got back from the worst flight of my life. 3 hour delay, lost luggage, and the person next to me kept elbowing me. On the bright side, I finished my book and the flight attendant gave me free cookies because she felt bad. Sometimes the small wins matter. Anyone else have travel horror stories this week?`,
      source: 'linkedin',
      submittedAt: new Date(Date.now() - 14400000),
      submittedBy: 'Anonymous User',
      declaredAsAi: false,
      votes: { ai: 12, human: 189 },
      aiIndicators: [],
      humanIndicators: [
        'Specific personal anecdote',
        'Natural conversational tone',
        'Unpredictable narrative',
        'Authentic emotional expression'
      ],
      analysis: {
        aiInfluenceScore: 15,
        aiPatternPercentage: 8,
        citationAnalysis: {
          totalClaims: 1,
          citedClaims: 0,
          uncitedClaims: 1,
          citationScore: 85
        },
        patterns: [
          { category: 'Motivational Clichés', detected: false, weight: 0, description: 'Generic inspirational phrases' },
          { category: 'Engagement Bait', detected: false, weight: 0, description: 'Call-to-action phrases' },
          { category: 'Personal Anecdote', detected: true, weight: -25, description: 'Specific personal story with details' },
          { category: 'Emotional Authenticity', detected: true, weight: -20, description: 'Genuine emotional expression' },
          { category: 'Conversational Tone', detected: true, weight: -15, description: 'Natural, casual writing style' },
          { category: 'Unpredictable Flow', detected: true, weight: -10, description: 'Non-formulaic narrative structure' }
        ]
      }
    },
    {
      id: '3',
      content: `BREAKING: Scientists at MIT have discovered a revolutionary new method for carbon capture that could reduce atmospheric CO2 by up to 40% over the next decade. The innovative technique uses genetically modified algae combined with nano-particle filters to absorb carbon at unprecedented rates. Dr. Sarah Chen, lead researcher, stated that "this breakthrough could fundamentally change our approach to climate change." The technology is expected to be commercially viable within 5 years.`,
      source: 'news',
      sourceUrl: 'https://news-example.com/article',
      submittedAt: new Date(Date.now() - 28800000),
      submittedBy: 'Anonymous User',
      declaredAsAi: false,
      votes: { ai: 167, human: 45 },
      aiIndicators: [
        'Sensationalized claims',
        'Unverifiable statistics (40%)',
        'Generic expert quote',
        'Vague timeline promises'
      ],
      humanIndicators: [
        'Specific institution mentioned',
        'Named researcher'
      ],
      analysis: {
        aiInfluenceScore: 82,
        aiPatternPercentage: 68,
        citationAnalysis: {
          totalClaims: 5,
          citedClaims: 1,
          uncitedClaims: 4,
          citationScore: 20
        },
        patterns: [
          { category: 'Sensationalism', detected: true, weight: 25, description: 'Exaggerated claims ("revolutionary", "unprecedented")' },
          { category: 'Unverified Statistics', detected: true, weight: 22, description: 'Specific numbers without source (40%)' },
          { category: 'Vague Promises', detected: true, weight: 18, description: 'Future predictions without evidence' },
          { category: 'Generic Quotes', detected: true, weight: 12, description: 'Quote sounds templated' },
          { category: 'Missing Citations', detected: true, weight: 15, description: '4 of 5 claims lack sources' },
          { category: 'Named Sources', detected: true, weight: -10, description: 'Specific researcher mentioned' }
        ]
      }
    },
    {
      id: '4',
      content: `Thread: I spent 6 months investigating why my startup failed. Here's what I found 🧵

1/ We raised $2M in 2022 for an AI writing tool. By 2023, ChatGPT had eaten our lunch. But that's not why we failed.

2/ The real reason: I was so focused on the product that I ignored unit economics. We were spending $47 to acquire customers worth $31.

3/ My co-founder and I stopped talking honestly. We'd have meetings where neither of us said what we actually thought.

4/ When we finally had the hard conversation, it was too late. We'd burned through 80% of runway avoiding the obvious.

5/ What I'd do differently: Monthly "brutal honesty" sessions. No ego, just numbers and truth.`,
      source: 'twitter',
      submittedAt: new Date(Date.now() - 43200000),
      submittedBy: 'Anonymous User',
      declaredAsAi: false,
      votes: { ai: 34, human: 156 },
      aiIndicators: [
        'Thread format common in AI content',
        'Numbered structure'
      ],
      humanIndicators: [
        'Specific financial details',
        'Admission of personal failure',
        'Concrete timeline',
        'Emotional vulnerability',
        'Unique business details'
      ],
      analysis: {
        aiInfluenceScore: 28,
        aiPatternPercentage: 22,
        citationAnalysis: {
          totalClaims: 4,
          citedClaims: 4,
          uncitedClaims: 0,
          citationScore: 95
        },
        patterns: [
          { category: 'Thread Format', detected: true, weight: 8, description: 'Common AI content structure' },
          { category: 'Numbered List', detected: true, weight: 5, description: 'Structured list format' },
          { category: 'Specific Financials', detected: true, weight: -22, description: 'Exact dollar amounts ($2M, $47, $31)' },
          { category: 'Personal Failure', detected: true, weight: -20, description: 'Vulnerable admission of mistakes' },
          { category: 'Unique Details', detected: true, weight: -18, description: 'Specific business context' },
          { category: 'Timeline Specifics', detected: true, weight: -15, description: '6 months, 2022, 2023' }
        ]
      }
    },
    {
      id: '5',
      content: `According to recent studies, implementing a robust morning routine can increase productivity by up to 300%. The most successful entrepreneurs wake up at 5 AM and practice mindfulness meditation. Research shows that cold showers boost dopamine levels by 250%. By following these simple steps, you too can unlock your full potential and achieve unprecedented success in your personal and professional life.`,
      source: 'linkedin',
      submittedAt: new Date(Date.now() - 86400000),
      submittedBy: 'Anonymous User',
      declaredAsAi: true,
      declaredAt: new Date(Date.now() - 72000000),
      votes: { ai: 234, human: 12 },
      aiIndicators: [
        'Vague "studies" without citations',
        'Unrealistic statistics (300%, 250%)',
        'Generic success advice',
        'Buzzwords ("unlock potential")'
      ],
      humanIndicators: [],
      analysis: {
        aiInfluenceScore: 94,
        aiPatternPercentage: 89,
        citationAnalysis: {
          totalClaims: 4,
          citedClaims: 0,
          uncitedClaims: 4,
          citationScore: 0
        },
        patterns: [
          { category: 'Uncited Studies', detected: true, weight: 28, description: '"According to studies" without source' },
          { category: 'Unrealistic Statistics', detected: true, weight: 25, description: 'Extreme percentages (300%, 250%)' },
          { category: 'Generic Advice', detected: true, weight: 20, description: 'Common productivity tips' },
          { category: 'Buzzword Usage', detected: true, weight: 15, description: '"Unlock potential", "unprecedented success"' },
          { category: 'No Personal Experience', detected: true, weight: 12, description: 'No specific personal story' },
          { category: 'Formulaic Promise', detected: true, weight: 10, description: '"You too can achieve..."' }
        ]
      }
    }
  ]);

  submissions = this.submissionsSignal.asReadonly();

  submitForReview(content: string, source: 'linkedin' | 'news' | 'twitter' | 'other', sourceUrl?: string, declareAsAi: boolean = false): void {
    // Simulate AI analysis
    const analysis = this.analyzeContent(content);
    
    const newSubmission: ReviewSubmission = {
      id: Date.now().toString(),
      content,
      source,
      sourceUrl,
      submittedAt: new Date(),
      submittedBy: 'You',
      declaredAsAi: declareAsAi,
      declaredAt: declareAsAi ? new Date() : undefined,
      votes: { ai: declareAsAi ? 1 : 0, human: 0 },
      aiIndicators: this.detectAiIndicators(content),
      humanIndicators: this.detectHumanIndicators(content),
      analysis
    };

    this.submissionsSignal.update(subs => [newSubmission, ...subs]);
  }

  toggleAiDeclaration(submissionId: string): void {
    this.submissionsSignal.update(subs =>
      subs.map(sub => {
        if (sub.id !== submissionId) return sub;
        
        const newDeclaredState = !sub.declaredAsAi;
        return {
          ...sub,
          declaredAsAi: newDeclaredState,
          declaredAt: newDeclaredState ? new Date() : undefined
        };
      })
    );
  }

  private analyzeContent(content: string): ContentAnalysis {
    const patterns = this.detectPatterns(content);
    const aiScore = this.calculateAiScore(patterns);
    const citationAnalysis = this.analyzeCitations(content);
    
    return {
      aiInfluenceScore: aiScore,
      aiPatternPercentage: Math.min(95, Math.max(5, aiScore + Math.random() * 10 - 5)),
      citationAnalysis,
      patterns
    };
  }

  private detectPatterns(content: string): ContentAnalysis['patterns'] {
    const lowerContent = content.toLowerCase();
    const patterns: ContentAnalysis['patterns'] = [];

    // AI Pattern Detection
    const hasMotivationalCliches = /success|journey|mindset|unlock|potential|achieve/.test(lowerContent);
    patterns.push({
      category: 'Motivational Clichés',
      detected: hasMotivationalCliches,
      weight: hasMotivationalCliches ? 20 : 0,
      description: 'Generic inspirational phrases commonly used by AI'
    });

    const hasEngagementBait = /comment|share|like|follow|thoughts\?|drop|below/.test(lowerContent);
    patterns.push({
      category: 'Engagement Bait',
      detected: hasEngagementBait,
      weight: hasEngagementBait ? 18 : 0,
      description: 'Call-to-action designed to boost engagement'
    });

    const hashtagCount = (content.match(/#\w+/g) || []).length;
    const hasHashtagStuffing = hashtagCount > 3;
    patterns.push({
      category: 'Hashtag Stuffing',
      detected: hasHashtagStuffing,
      weight: hasHashtagStuffing ? 12 : 0,
      description: `${hashtagCount} hashtags detected`
    });

    const hasUncitedStats = /\d+%|studies show|research shows|according to/.test(lowerContent) && 
                           !/http|www\.|source:|cited|reference/.test(lowerContent);
    patterns.push({
      category: 'Uncited Statistics',
      detected: hasUncitedStats,
      weight: hasUncitedStats ? 25 : 0,
      description: 'Statistics or claims without proper citations'
    });

    const hasBuzzwords = /revolutionary|unprecedented|game-?changing|innovative|cutting-?edge/.test(lowerContent);
    patterns.push({
      category: 'Buzzword Usage',
      detected: hasBuzzwords,
      weight: hasBuzzwords ? 15 : 0,
      description: 'Overused marketing buzzwords'
    });

    // Human Pattern Detection
    const hasSpecificDetails = /\$\d+|\d{4}|monday|tuesday|wednesday|thursday|friday|january|february/.test(lowerContent);
    patterns.push({
      category: 'Specific Details',
      detected: hasSpecificDetails,
      weight: hasSpecificDetails ? -20 : 0,
      description: 'Concrete dates, amounts, or specifics'
    });

    const hasPersonalStory = /my |i was|i had|i felt|i learned|happened to me/.test(lowerContent);
    patterns.push({
      category: 'Personal Anecdote',
      detected: hasPersonalStory,
      weight: hasPersonalStory ? -18 : 0,
      description: 'First-person experience sharing'
    });

    const hasEmotionalWords = /frustrated|excited|scared|angry|loved|hated|embarrassed|proud/.test(lowerContent);
    patterns.push({
      category: 'Emotional Authenticity',
      detected: hasEmotionalWords,
      weight: hasEmotionalWords ? -15 : 0,
      description: 'Genuine emotional expressions'
    });

    return patterns;
  }

  private calculateAiScore(patterns: ContentAnalysis['patterns']): number {
    const totalWeight = patterns.reduce((sum, p) => sum + p.weight, 0);
    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, 50 + totalWeight));
  }

  private analyzeCitations(content: string): ContentAnalysis['citationAnalysis'] {
    // Simple claim detection (sentences with statistics, studies, or definitive statements)
    const claimPatterns = /\d+%|studies|research|according to|proven|shows that|evidence|data|statistics/gi;
    const claims = content.match(claimPatterns) || [];
    const totalClaims = Math.max(1, claims.length);
    
    // Check for citations
    const citationPatterns = /http|www\.|source:|cited|reference|\[\d+\]|\(\d{4}\)/gi;
    const citations = content.match(citationPatterns) || [];
    const citedClaims = Math.min(totalClaims, citations.length);
    
    const uncitedClaims = totalClaims - citedClaims;
    const citationScore = totalClaims > 0 ? Math.round((citedClaims / totalClaims) * 100) : 100;

    return { totalClaims, citedClaims, uncitedClaims, citationScore };
  }

  private detectAiIndicators(content: string): string[] {
    const indicators: string[] = [];
    const lower = content.toLowerCase();

    if (/success|journey|mindset/.test(lower)) indicators.push('Motivational clichés');
    if (/comment|share|thoughts\?/.test(lower)) indicators.push('Engagement bait phrases');
    if ((content.match(/#\w+/g) || []).length > 3) indicators.push('Excessive hashtags');
    if (/studies show|research shows/.test(lower) && !/source|http/.test(lower)) indicators.push('Uncited claims');
    if (/revolutionary|unprecedented|game-changing/.test(lower)) indicators.push('Marketing buzzwords');

    return indicators;
  }

  private detectHumanIndicators(content: string): string[] {
    const indicators: string[] = [];
    const lower = content.toLowerCase();

    if (/\$\d+/.test(lower)) indicators.push('Specific financial details');
    if (/i was|i had|happened to me/.test(lower)) indicators.push('Personal anecdote');
    if (/frustrated|scared|embarrassed/.test(lower)) indicators.push('Authentic emotions');
    if (/monday|tuesday|\d{4}/.test(lower)) indicators.push('Specific dates/times');

    return indicators;
  }

  vote(submissionId: string, vote: 'ai' | 'human'): void {
    this.submissionsSignal.update(subs =>
      subs.map(sub => {
        if (sub.id !== submissionId) return sub;

        const votes = { ...sub.votes };
        const previousVote = votes.userVote;

        if (previousVote === 'ai') votes.ai = Math.max(0, votes.ai - 1);
        if (previousVote === 'human') votes.human = Math.max(0, votes.human - 1);

        if (previousVote === vote) {
          votes.userVote = null;
        } else {
          votes.userVote = vote;
          if (vote === 'ai') votes.ai++;
          else votes.human++;
        }

        return { ...sub, votes };
      })
    );
  }

  getConfidence(submission: ReviewSubmission): { level: string; percentage: number; color: string } {
    const total = submission.votes.ai + submission.votes.human;
    if (total === 0) return { level: 'Awaiting Votes', percentage: 50, color: '#8b949e' };

    const aiPercentage = (submission.votes.ai / total) * 100;

    if (aiPercentage >= 70) return { level: 'Likely AI-Generated', percentage: aiPercentage, color: '#b392f0' };
    if (aiPercentage >= 30) return { level: 'Uncertain / Mixed', percentage: aiPercentage, color: '#d4a054' };
    return { level: 'Likely Human-Written', percentage: aiPercentage, color: '#58a6ff' };
  }
}

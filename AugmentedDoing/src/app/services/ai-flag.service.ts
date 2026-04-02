/**
 * AI Flag Service — manages AI content flagging, detection, and trust scores.
 *
 * Provides:
 * - Flag content as AI/human/disputed/misleading
 * - Get AI detection analysis & trust score
 * - Get corrective action recommendations
 * - Mock mode for demo/development
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from './environment';
import {
  AiDetectionResult,
  AiFlagSummary,
  ContentTrustResult,
  CorrectiveReport,
} from '../models/analysis.model';

export interface FlagRequest {
  postId: string;
  flagType: 'ai' | 'human' | 'disputed' | 'misleading';
  reason?: string;
  confidence?: number;
}

export interface FlagResponse {
  flagId: string;
  status: string;
  summary: AiFlagSummary;
}

@Injectable({ providedIn: 'root' })
export class AiFlagService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBase;

  /** Flag content as AI-generated, human, disputed, or misleading. */
  flagContent(req: FlagRequest): Observable<FlagResponse> {
    if (environment.mockMode) {
      return of(this._mockFlagResponse(req));
    }
    return this.http.post<FlagResponse>(`${this.baseUrl}/flag-ai-content`, {
      postId: req.postId,
      flagType: req.flagType,
      reason: req.reason ?? '',
      confidence: req.confidence ?? 3,
    }).pipe(catchError(() => of(this._mockFlagResponse(req))));
  }

  /** Get full content trust analysis (detection + flags + corrections). */
  getContentTrust(postId: string): Observable<ContentTrustResult> {
    if (environment.mockMode) {
      return of(this._mockContentTrust(postId));
    }
    return this.http.get<ContentTrustResult>(`${this.baseUrl}/content-trust/${postId}`)
      .pipe(catchError(() => of(this._mockContentTrust(postId))));
  }

  /** Get corrective actions only. */
  getCorrectiveActions(postId: string): Observable<{ actions: any[]; overallRisk: string; summary: string }> {
    if (environment.mockMode) {
      return of(this._mockCorrections(postId));
    }
    return this.http.get<any>(`${this.baseUrl}/corrective-actions/${postId}`)
      .pipe(catchError(() => of(this._mockCorrections(postId))));
  }

  // ── Mock data ─────────────────────────────────────────────────────────────

  private _mockFlagResponse(req: FlagRequest): FlagResponse {
    const hash = this._hash(req.postId);
    return {
      flagId: `flag-${Date.now()}`,
      status: 'recorded',
      summary: {
        postId: req.postId,
        totalFlags: 15 + (hash % 40),
        aiFlags: req.flagType === 'ai' ? 10 + (hash % 20) : 3,
        humanFlags: req.flagType === 'human' ? 10 + (hash % 20) : 5,
        disputedFlags: 2,
        misleadingFlags: 1,
        avgConfidence: 3.2 + (hash % 15) / 10,
        recommendedLabel: req.flagType === 'ai' ? 'ai-generated' : 'uncertain',
        consensusStrength: 0.65 + (hash % 25) / 100,
      },
    };
  }

  private _mockContentTrust(postId: string): ContentTrustResult {
    const hash = this._hash(postId);
    const aiProb = 0.3 + (hash % 50) / 100;
    const isHighAi = aiProb > 0.65;
    return {
      postId,
      detection: {
        overallAiProbability: aiProb,
        trustScore: (1 - aiProb) * 100,
        recommendedLabel: isHighAi ? 'likely-ai' : aiProb > 0.4 ? 'uncertain' : 'likely-human',
        confidence: 0.7 + (hash % 20) / 100,
        linguisticScore: 0.2 + (hash % 40) / 100,
        structuralScore: 0.15 + (hash % 35) / 100,
        statisticalScore: 0.1 + (hash % 30) / 100,
        communityScore: 0.5 + (hash % 30) / 100,
        authorDeclarationWeight: 0,
        signals: [
          `Linguistic: ${2 + hash % 5} AI-typical phrases detected`,
          `Structural: sentence-length CV=${(0.3 + hash % 40 / 100).toFixed(2)}`,
          `Community: ${10 + hash % 30} AI flags vs ${5 + hash % 20} human flags`,
        ],
        riskFactors: isHighAi
          ? ['Elevated AI probability — recommend AI content advisory', 'Both linguistic and structural AI patterns detected']
          : [],
        recommendation: isHighAi
          ? 'AI probability exceeds threshold. Recommend applying "AI Content" label.'
          : 'Content appears authentically human-created. No AI label needed.',
      },
      flags: {
        postId,
        totalFlags: 15 + (hash % 30),
        aiFlags: 8 + (hash % 15),
        humanFlags: 5 + (hash % 10),
        disputedFlags: 2,
        misleadingFlags: 1,
        avgConfidence: 3.4,
        recommendedLabel: isHighAi ? 'ai-generated' : 'uncertain',
        consensusStrength: 0.6 + (hash % 30) / 100,
      },
      corrections: this._mockCorrectiveReport(postId, aiProb, isHighAi),
    };
  }

  private _mockCorrectiveReport(postId: string, aiProb: number, isHighAi: boolean): CorrectiveReport {
    const actions = [];
    if (isHighAi) {
      actions.push(
        {
          actionId: `${postId}-CA-001`, category: 'labeling' as const, severity: 'required' as const,
          title: 'Apply "AI Content" Label',
          description: 'Attach a visible AI Content badge to this post.',
          rationale: `AI detection probability: ${(aiProb * 100).toFixed(0)}%. Platform transparency policy requires labeling.`,
          automated: true,
        },
        {
          actionId: `${postId}-CA-002`, category: 'suppression' as const, severity: 'recommended' as const,
          title: 'Reduce Algorithmic Amplification',
          description: 'Reduce this post\'s weight in recommendation algorithms by 30-50%.',
          rationale: 'AI content should not be amplified at the same rate as organic human content.',
          automated: true,
        },
        {
          actionId: `${postId}-CA-003`, category: 'transparency' as const, severity: 'recommended' as const,
          title: 'Show AI Detection Analysis',
          description: 'Display the AI detection breakdown to users who click the AI label.',
          rationale: 'Empowering users with evidence supports informed engagement.',
          automated: false,
        },
      );
    } else {
      actions.push({
        actionId: `${postId}-CA-001`, category: 'labeling' as const, severity: 'advisory' as const,
        title: 'Apply "Disputed Origin" Label',
        description: 'Mark content as having uncertain AI/human origin.',
        rationale: `AI probability ${(aiProb * 100).toFixed(0)}% is in the uncertain range.`,
        automated: true,
      });
    }
    actions.push({
      actionId: `${postId}-CA-${actions.length + 1}`, category: 'education' as const, severity: 'info' as const,
      title: 'AI Content Awareness',
      description: 'This post has been analyzed by TrustFeed\'s multi-signal AI detection system.',
      rationale: 'Transparency about the detection process builds user trust.',
      automated: false,
    });

    return {
      overallRisk: isHighAi ? 'high' : 'medium',
      trustScore: (1 - aiProb) * 100,
      summary: `Post ${postId}: Risk ${isHighAi ? 'HIGH' : 'MEDIUM'}. AI probability ${(aiProb * 100).toFixed(0)}%. ${actions.length} corrective actions.`,
      actions,
    };
  }

  private _mockCorrections(postId: string) {
    const hash = this._hash(postId);
    const aiProb = 0.3 + (hash % 50) / 100;
    const report = this._mockCorrectiveReport(postId, aiProb, aiProb > 0.65);
    return {
      actions: report.actions,
      overallRisk: report.overallRisk,
      summary: report.summary,
    };
  }

  private _hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}

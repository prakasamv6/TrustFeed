import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { environment } from './environment';
import {
  FairnessSurveyRequest,
  FairnessSurveyResult,
  FairnessSurveySummary,
  FairnessSurveyResponseItem,
  FactorAttributionReport,
  AgentAttribution,
  FactorContribution,
} from '../models/analysis.model';
import { FairnessTrendPoint, FairnessTrends } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class FairnessSurveyService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBase;
  private mockMode = environment.mockMode;

  submitSurvey(request: FairnessSurveyRequest): Observable<{ id: string; status: string }> {
    if (this.mockMode) {
      return of({ id: crypto.randomUUID(), status: 'saved' }).pipe(delay(500));
    }
    return this.http.post<{ id: string; status: string }>(`${this.apiBase}/fairness-survey`, request);
  }

  getSurveyResults(postId: string): Observable<FairnessSurveyResult> {
    if (this.mockMode) {
      return of(this.mockSurveyResults(postId)).pipe(delay(400));
    }
    return this.http.get<FairnessSurveyResult>(`${this.apiBase}/fairness-survey/${postId}`);
  }

  getFairnessTrends(): Observable<FairnessTrends> {
    if (this.mockMode) {
      return of(this.mockFairnessTrends()).pipe(delay(400));
    }
    return this.http.get<FairnessTrends>(`${this.apiBase}/dashboard/fairness-trends`);
  }

  /** Generate a mock factor attribution for demo/mock mode. */
  generateMockAttribution(postId: string): FactorAttributionReport {
    const seed = this.hashString(postId);
    const regions = ['Africa', 'Asia', 'Europe', 'Americas', 'Oceania'] as const;
    const factors: string[] = ['laplacian_variance', 'edge_density', 'color_uniformity', 'bias_direction', 'formal_language_penalty'];

    const agentAttributions: AgentAttribution[] = regions.map((region, i) => {
      const baselineScore = 0.3 + (seed % 40) / 100;
      const delta = ((seed + i * 13) % 20) / 100 * (i % 2 === 0 ? 1 : -1);
      const agentScore = +(baselineScore + delta).toFixed(4);

      const agentFactors: FactorContribution[] = factors.map((f, fi) => {
        const contribution = +((((seed + i * 7 + fi * 3) % 15) - 7) / 1000).toFixed(6);
        return {
          factorName: f,
          factorCategory: f === 'bias_direction' ? 'bias_direction' as const : 'feature_weight' as const,
          rawValue: +((seed + fi) % 100 / 100).toFixed(4),
          weight: +(0.8 + ((seed + fi * 11) % 50) / 100).toFixed(2),
          contribution,
          contributionPct: +(Math.abs(contribution) * 100 / 0.05).toFixed(1),
          description: `${f}: mock factor contribution of ${contribution.toFixed(4)}`,
        };
      });

      return {
        agentName: `${region}BiasAgent`,
        region,
        agentScore,
        baselineScore,
        totalDelta: +delta.toFixed(4),
        factors: agentFactors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
        topFactor: agentFactors[0].factorName,
        summary: `${region}BiasAgent diverges by ${delta.toFixed(4)} from baseline.`,
      };
    });

    return {
      agentAttributions,
      globalTopFactors: ['bias_direction', 'laplacian_variance', 'edge_density'],
      proxyRiskIndicators: [
        'Africa: formal_language_penalty — language formality can correlate with education level or cultural background',
      ],
      fairnessSummary: `Factor attribution analysed ${regions.length} regional agents. Mock data for demonstration purposes.`,
    };
  }

  private mockSurveyResults(postId: string): FairnessSurveyResult {
    const seed = this.hashString(postId);
    const count = 3 + (seed % 5);
    const responses: FairnessSurveyResponseItem[] = [];

    for (let i = 0; i < count; i++) {
      responses.push({
        id: `mock-${i}-${seed}`,
        originalFairness: 1 + ((seed + i) % 5),
        nonbiasedFairness: 2 + ((seed + i * 3) % 4),
        explanationClarity: 2 + ((seed + i * 7) % 4),
        trustImpact: 1 + ((seed + i * 11) % 5),
        perceivedBiasSeverity: 1 + ((seed + i * 13) % 5),
        comment: i === 0 ? 'The non-biased result seems more equitable.' : '',
        createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
      });
    }

    const avg = (field: keyof FairnessSurveyResponseItem) =>
      +(responses.reduce((s, r) => s + (r[field] as number), 0) / count).toFixed(2);

    return {
      postId,
      responses,
      summary: {
        avgOriginalFairness: avg('originalFairness'),
        avgNonbiasedFairness: avg('nonbiasedFairness'),
        avgExplanationClarity: avg('explanationClarity'),
        avgTrustImpact: avg('trustImpact'),
        avgPerceivedBias: avg('perceivedBiasSeverity'),
        responseCount: count,
      },
    };
  }

  private mockFairnessTrends(): FairnessTrends {
    const points: FairnessTrendPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      points.push({
        date: d.toISOString().split('T')[0],
        avgOriginalFairness: +(2.5 + Math.random() * 1.5).toFixed(2),
        avgNonbiasedFairness: +(3.2 + Math.random() * 1.2).toFixed(2),
        avgExplanationClarity: +(3 + Math.random() * 1).toFixed(2),
        avgTrustImpact: +(2.8 + Math.random() * 1.5).toFixed(2),
        avgPerceivedBias: +(2 + Math.random() * 2).toFixed(2),
        responseCount: 2 + Math.floor(Math.random() * 8),
      });
    }
    return { points };
  }

  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}

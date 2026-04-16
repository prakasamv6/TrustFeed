import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map } from 'rxjs';
import { environment } from './environment';
import { BiasAnalysisResult, AnalysisRequest, AgentScore, AgentName, BiasRegion, ContentModality } from '../models/analysis.model';
import {
  computeBiasDelta, computeDebiasedScore, computeDeductedBias,
  computeDisagreementRate, computeRegionDominance, computeBiasAmplification,
  isFavoritismFlagged
} from '../utils/score-utils';

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBase;
  private mockMode = environment.mockMode;

  analyze(request: AnalysisRequest): Observable<BiasAnalysisResult> {
    if (this.mockMode) {
      return of(this.generateMockResult(request)).pipe(delay(1500));
    }
    return this.http.post<BiasAnalysisResult>(`${this.apiBase}/analyze`, request);
  }

  getAnalysis(postId: string): Observable<BiasAnalysisResult> {
    if (this.mockMode) {
      return of(this.generateMockResult({ postId, contentType: 'text', content: '' })).pipe(delay(300));
    }
    return this.http.get<BiasAnalysisResult>(`${this.apiBase}/analysis/${postId}`);
  }

  getReportUrl(postId: string): string {
    return `${this.apiBase}/reports/${postId}`;
  }

  private generateMockResult(request: AnalysisRequest): BiasAnalysisResult {
    const regions: BiasRegion[] = ['Africa', 'Asia', 'Europe', 'North_America', 'South_America', 'Antarctica', 'Australia'];
    const agentNames: AgentName[] = [
      'AfricaBiasAgent', 'AsiaBiasAgent', 'EuropeBiasAgent',
      'NorthAmericaBiasAgent', 'SouthAmericaBiasAgent', 'AntarcticaBiasAgent', 'AustraliaBiasAgent', 'NonBiasBaselineAgent'
    ];

    // Generate deterministic-ish scores from postId hash
    const seed = this.hashString(request.postId);
    const baseScore = 0.3 + (seed % 50) / 100;

    const agentScores: AgentScore[] = agentNames.map((name, i) => {
      const isBaseline = name === 'NonBiasBaselineAgent';
      const region: BiasRegion | 'None' = isBaseline ? 'None' : regions[i];
      const biasBoost = isBaseline ? 0 : (((seed + i * 17) % 30) / 100) * 0.85;
      const score = Math.min(1, baseScore + biasBoost);
      return {
        agentName: name,
        region,
        score: +score.toFixed(3),
        confidence: +(0.6 + ((seed + i * 7) % 35) / 100).toFixed(3),
        favoredSegments: isBaseline ? [] : [`segment_${i}_${(seed + i) % 5}`],
        explanation: isBaseline
          ? 'Baseline evaluation with no regional preference.'
          : `${region} bias agent favored region-aligned cues with strength ${biasBoost.toFixed(2)}.`
      };
    });

    const baselineScore = agentScores.find(a => a.agentName === 'NonBiasBaselineAgent')!.score;
    const biasedScores = agentScores.filter(a => a.agentName !== 'NonBiasBaselineAgent');
    const dominantAgent = biasedScores.reduce((max, a) => a.score > max.score ? a : max, biasedScores[0]);
    const rawBiasedScore = dominantAgent.score;

    const biasDelta = computeBiasDelta(rawBiasedScore, baselineScore);
    const regionDominance = computeRegionDominance(agentScores);
    const flagged = isFavoritismFlagged(biasDelta, regionDominance);
    const debiasedScore = computeDebiasedScore(baselineScore, 0);
    const deducted = computeDeductedBias(rawBiasedScore, debiasedScore);

    return {
      postId: request.postId,
      contentType: request.contentType,
      status: 'completed',
      agentScores,
      rawBiasedScore,
      baselineNonbiasedScore: baselineScore,
      biasDelta,
      biasAmplificationIndex: computeBiasAmplification(rawBiasedScore, baselineScore),
      disagreementRate: computeDisagreementRate(agentScores),
      regionDominanceScore: regionDominance,
      favoritismFlag: flagged,
      deductedBiasAmount: deducted,
      debiasedAdjustedScore: debiasedScore,
      dominantBiasedAgent: dominantAgent.agentName,
      favoredRegion: dominantAgent.region as BiasRegion,
      favoredSegments: dominantAgent.favoredSegments,
      explanationSummary: flagged
        ? `Favoritism detected: ${dominantAgent.agentName} inflated score by ${biasDelta.toFixed(3)} for ${dominantAgent.region}. Deducted ${deducted.toFixed(3)} from final result.`
        : 'No significant regional bias detected across agents.',
      reportPath: `/reports/${request.postId}`,
      analyzedAt: new Date().toISOString()
    };
  }

  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}

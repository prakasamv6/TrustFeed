/**
 * ApiService — Persists anonymous survey data to TrustFeed MySQL via Express API.
 * NO PII is transmitted or stored. All data is strictly session/analysis data.
 * Enhanced with retry logic, timeouts, and error notification integration.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout, retry, catchError, of } from 'rxjs';
import { SurveyItem, SurveyResults, FetchedContentItem } from '../models/survey.model';
import { ErrorNotificationService } from './error-notification.service';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private readonly baseUrl = '/api';
  private readonly http = inject(HttpClient);
  private readonly errorService = inject(ErrorNotificationService);

  /** Create a new anonymous survey session. Retries once on failure. */
  createSession(sessionId: string, startedAt: Date, collabMode: boolean, itemCount: number) {
    return this.http.post(`${this.baseUrl}/sessions`, {
      sessionId, startedAt: startedAt.toISOString(), collabMode, itemCount,
    }).pipe(
      timeout(10000),
      retry({ count: 1, delay: 2000 }),
      catchError((err) => {
        console.error('Failed to create session:', err);
        this.errorService.sessionSaveFailed();
        return of(null);
      }),
    ).subscribe();
  }

  /** Save a single item response + agent verdicts. Retries once on failure. */
  saveResponse(sessionId: string, item: SurveyItem, itemIndex: number) {
    return this.http.post(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/responses`, {
      itemIndex,
      itemTitle: item.title,
      itemCategory: item.category,
      itemDifficulty: item.difficulty,
      contentType: item.contentType,
      groundTruth: item.groundTruth,
      humanVerdict: item.humanVerdict,
      humanConfidence: item.humanConfidence,
      humanReasoning: item.humanReasoning || null,
      agentVerdicts: item.agentVerdicts.map(av => ({
        region: av.region,
        verdict: av.verdict,
        confidence: av.confidence,
        reasoning: av.reasoning,
      })),
    }).pipe(
      timeout(10000),
      retry({ count: 1, delay: 2000 }),
      catchError((err) => {
        console.error('Failed to save response:', err);
        this.errorService.responseSaveFailed(itemIndex);
        return of(null);
      }),
    ).subscribe();
  }

  /** Complete a session with computed results. Retries once on failure. */
  completeSession(results: SurveyResults) {
    return this.http.put(`${this.baseUrl}/sessions/${encodeURIComponent(results.sessionId)}/complete`, {
      completedAt: new Date().toISOString(),
      humanCorrect: results.humanCorrect,
      humanAccuracy: results.humanAccuracy,
      humanAiCount: results.humanAiCount,
      humanHumanCount: results.humanHumanCount,
      actualAiCount: results.actualAiCount,
      actualHumanCount: results.actualHumanCount,
      agentResults: results.agentResults.map(ar => ({
        region: ar.region,
        correct: ar.correct,
        accuracy: ar.accuracy,
        aiCount: ar.aiCount,
        humanCount: ar.humanCount,
        avgConfidence: ar.avgConfidence,
      })),
      agreementMatrix: results.agreementMatrix.map(am => ({
        region: am.region,
        agreementRate: am.agreementRate,
      })),
    }).pipe(
      timeout(15000),
      retry({ count: 2, delay: 3000 }),
      catchError((err) => {
        console.error('Failed to complete session:', err);
        this.errorService.completionFailed();
        return of(null);
      }),
    ).subscribe();
  }

  /** Fetch aggregate analytics. */
  getAnalytics() {
    return this.http.get<any>(`${this.baseUrl}/analytics`).pipe(
      timeout(15000),
      catchError((err) => {
        console.error('Failed to fetch analytics:', err);
        return of(null);
      }),
    );
  }

  /** Fetch unique content from free internet sources via the backend. */
  async fetchContent(count: number): Promise<FetchedContentItem[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ items: FetchedContentItem[]; count: number; sources: string[] }>(
          `${this.baseUrl}/content/fetch?count=${encodeURIComponent(count)}`
        ).pipe(timeout(30000))
      );
      if (!res || !Array.isArray(res.items)) {
        throw new Error('Invalid response structure from content API');
      }
      return res.items;
    } catch (err) {
      console.error('Failed to fetch content from API:', err);
      return [];
    }
  }
}

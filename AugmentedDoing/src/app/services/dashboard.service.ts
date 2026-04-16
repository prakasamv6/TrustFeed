import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, catchError, map } from 'rxjs';
import { environment } from './environment';
import {
  DashboardSummary, DashboardAgentStats, DashboardTrends,
  AgentStat, TrendPoint, PostDrilldown, SurveyCompletionStats,
  AgentTrackingResponse, AnalyticsResponse,
  DbSessionsResponse, DbSurveySession,
} from '../models/dashboard.model';
import { AgentName, BiasRegion } from '../models/analysis.model';

interface SurveyHealthResponse {
  status?: string;
  database?: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBase;
  private mockMode = environment.mockMode;
  private surveyUrl = environment.surveyApiUrl;

  private asNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  getSurveyHealth(): Observable<SurveyHealthResponse> {
    return this.http.get<SurveyHealthResponse>(`${this.surveyUrl}/api/health`).pipe(
      catchError(() => of({ status: 'error', database: 'disconnected' }))
    );
  }

  // ── DB-Connected Methods (persistent MySQL data) ──────────────────────

  getAgentTracking(): Observable<AgentTrackingResponse> {
    return this.http.get<AgentTrackingResponse>(`${this.surveyUrl}/api/agent-tracking`).pipe(
      map(res => ({
        feedAnalysis: {
          agentStats: res.feedAnalysis?.agentStats ?? [],
          recentLogs: res.feedAnalysis?.recentLogs ?? [],
        },
        surveyVerdicts: res.surveyVerdicts ?? [],
        totalFeedAnalyses: res.totalFeedAnalyses ?? 0,
        totalSurveyVerdicts: res.totalSurveyVerdicts ?? 0,
      })),
      catchError(() => of({
        feedAnalysis: { agentStats: [], recentLogs: [] },
        surveyVerdicts: [],
        totalFeedAnalyses: 0,
        totalSurveyVerdicts: 0,
      }))
    );
  }

  getAnalytics(): Observable<AnalyticsResponse> {
    return this.http.get<AnalyticsResponse>(`${this.surveyUrl}/api/analytics`).pipe(
      catchError(() => of({
        totalCompletedSessions: 0,
        accuracyByMode: [],
        accuracyByDifficulty: [],
        agentAccuracy: [],
        accuracyByCategory: [],
      }))
    );
  }

  getDbSessions(): Observable<DbSurveySession[]> {
    return this.http.get<DbSessionsResponse>(`${this.surveyUrl}/api/sessions`).pipe(
      map(res => (res.sessions || []).map(s => ({
        ...s,
        collabMode: !!s.collabMode,
        totalItems: this.asNumber(s.totalItems),
        humanCorrect: this.asNumber(s.humanCorrect),
        humanAccuracy: this.asNumber(s.humanAccuracy),
        humanAiCount: this.asNumber(s.humanAiCount),
        humanHumanCount: this.asNumber(s.humanHumanCount),
        actualAiCount: this.asNumber(s.actualAiCount),
        actualHumanCount: this.asNumber(s.actualHumanCount),
        agentResults: (s.agentResults ?? []).map(a => ({
          ...a,
          correct: this.asNumber(a.correct),
          accuracy: this.asNumber(a.accuracy),
          aiCount: this.asNumber(a.aiCount),
          humanCount: this.asNumber(a.humanCount),
          avgConfidence: this.asNumber(a.avgConfidence),
        })),
        agreementMatrix: (s.agreementMatrix ?? []).map(a => ({
          ...a,
          agreementRate: this.asNumber(a.agreementRate),
        })),
      }))),
      catchError(() => of([]))
    );
  }

  // ── Core API Methods (with response-shape transformations) ────────────

  getSummary(): Observable<DashboardSummary> {
    if (this.mockMode) return of(this.mockSummary()).pipe(delay(400));
    return this.http.get<any>(`${this.apiBase}/dashboard/summary`).pipe(
      map(raw => ({
        totalAnalyzedPosts: raw.totalAnalysed ?? raw.totalAnalyzedPosts ?? 0,
        totalBiasFlaggedPosts: raw.flaggedCount ?? raw.totalBiasFlaggedPosts ?? 0,
        totalDebiasedPosts: raw.debiasedSafeCount ?? raw.totalDebiasedPosts ?? 0,
        averageBiasDelta: raw.avgBiasDelta ?? raw.averageBiasDelta ?? 0,
        averageDisagreementRate: raw.avgDisagreement ?? raw.averageDisagreementRate ?? 0,
        averageRegionDominance: raw.averageRegionDominance ?? 0,
        modalityBreakdown: raw.modalityBreakdown ?? { text: raw.totalAnalysed ?? 0, image: 0, video: 0 },
      })),
      catchError(() => of(this.mockSummary()))
    );
  }

  getAgentStats(): Observable<DashboardAgentStats> {
    if (this.mockMode) return of(this.mockAgentStats()).pipe(delay(400));
    const regionMap: Record<string, string> = {
      AfricaBiasAgent: 'Africa', AsiaBiasAgent: 'Asia', EuropeBiasAgent: 'Europe',
      NorthAmericaBiasAgent: 'North_America', SouthAmericaBiasAgent: 'South_America',
      AntarcticaBiasAgent: 'Antarctica', AustraliaBiasAgent: 'Australia', NonBiasBaselineAgent: 'None',
    };
    return this.http.get<any>(`${this.apiBase}/dashboard/agent-stats`).pipe(
      map(raw => {
        if (raw.agents) return raw as DashboardAgentStats;
        const agents: AgentStat[] = Object.entries(raw).map(([name, data]: [string, any]) => ({
          agentName: name as AgentName,
          region: (regionMap[name] || 'None') as BiasRegion | 'None',
          totalSelections: data.count ?? 0,
          averageScore: data.avgScore ?? 0,
          favoritismRate: 0,
          averageBiasDelta: 0,
        }));
        return { agents };
      }),
      catchError(() => of(this.mockAgentStats()))
    );
  }

  getTrends(): Observable<DashboardTrends> {
    if (this.mockMode) return of(this.mockTrends()).pipe(delay(400));
    return this.http.get<any>(`${this.apiBase}/dashboard/trends`).pipe(
      map(raw => {
        const arr = Array.isArray(raw) ? raw : raw.points || [];
        return {
          points: arr.map((pt: any) => ({
            date: pt.date,
            averageBiasDelta: pt.avgBiasDelta ?? pt.averageBiasDelta ?? 0,
            averageDebiasedScore: pt.avgDebiasedScore ?? pt.averageDebiasedScore ?? 0,
            totalAnalyzed: pt.count ?? pt.totalAnalyzed ?? 0,
            biasFlaggedCount: pt.biasFlaggedCount ?? 0,
          })),
        };
      }),
      catchError(() => of(this.mockTrends()))
    );
  }

  getSurveyCompletionStats(): Observable<SurveyCompletionStats> {
    return this.http.get<any>(`${this.surveyUrl}/api/survey-stats`).pipe(
      map(raw => this.normalizeSurveyCompletionStats(raw)),
      catchError(() => this.http.get<any>(`${this.apiBase}/survey-stats`).pipe(
        map(raw => this.normalizeSurveyCompletionStats(raw)),
        catchError(() => of(this.mockSurveyCompletionStats()))
      ))
    );
  }

  private normalizeSurveyCompletionStats(raw: any): SurveyCompletionStats {
    return {
      totalSessions: this.asNumber(raw?.totalSessions),
      completedSessions: this.asNumber(raw?.completedSessions),
      inProgressSessions: this.asNumber(raw?.inProgressSessions),
      completionRate: this.asNumber(raw?.completionRate),
      avgAccuracy: this.asNumber(raw?.avgAccuracy),
      avgItemsPerSession: this.asNumber(raw?.avgItemsPerSession),
      byMode: Array.isArray(raw?.byMode)
        ? raw.byMode.map((m: any) => ({
            mode: String(m?.mode ?? 'Unknown'),
            sessions: this.asNumber(m?.sessions),
            avgAccuracy: this.asNumber(m?.avgAccuracy),
          }))
        : [],
      byDifficulty: Array.isArray(raw?.byDifficulty)
        ? raw.byDifficulty.map((d: any) => ({
            difficulty: String(d?.difficulty ?? 'Unknown'),
            total: this.asNumber(d?.total),
            correct: this.asNumber(d?.correct),
            accuracy: this.asNumber(d?.accuracy),
          }))
        : [],
      recentCompletions: Array.isArray(raw?.recentCompletions)
        ? raw.recentCompletions.map((r: any) => ({
            date: String(r?.date ?? ''),
            completedCount: this.asNumber(r?.completedCount),
          }))
        : [],
    };
  }

  private mockSummary(): DashboardSummary {
    return {
      totalAnalyzedPosts: 24,
      totalBiasFlaggedPosts: 9,
      totalDebiasedPosts: 18,
      averageBiasDelta: 0.187,
      averageDisagreementRate: 0.312,
      averageRegionDominance: 0.445,
      modalityBreakdown: { text: 14, image: 7, video: 3 }
    };
  }

  private mockAgentStats(): DashboardAgentStats {
    const agents: AgentStat[] = [
      { agentName: 'AfricaBiasAgent', region: 'Africa', totalSelections: 18, averageScore: 0.68, favoritismRate: 0.44, averageBiasDelta: 0.19 },
      { agentName: 'AsiaBiasAgent', region: 'Asia', totalSelections: 22, averageScore: 0.72, favoritismRate: 0.52, averageBiasDelta: 0.23 },
      { agentName: 'EuropeBiasAgent', region: 'Europe', totalSelections: 20, averageScore: 0.65, favoritismRate: 0.38, averageBiasDelta: 0.16 },
      { agentName: 'NorthAmericaBiasAgent', region: 'North_America', totalSelections: 25, averageScore: 0.71, favoritismRate: 0.48, averageBiasDelta: 0.21 },
      { agentName: 'SouthAmericaBiasAgent', region: 'South_America', totalSelections: 19, averageScore: 0.67, favoritismRate: 0.41, averageBiasDelta: 0.17 },
      { agentName: 'AntarcticaBiasAgent', region: 'Antarctica', totalSelections: 15, averageScore: 0.63, favoritismRate: 0.35, averageBiasDelta: 0.14 },
      { agentName: 'AustraliaBiasAgent', region: 'Australia', totalSelections: 17, averageScore: 0.66, favoritismRate: 0.40, averageBiasDelta: 0.15 },
      { agentName: 'NonBiasBaselineAgent', region: 'None', totalSelections: 24, averageScore: 0.49, favoritismRate: 0, averageBiasDelta: 0 },
    ];
    return { agents };
  }

  private mockTrends(): DashboardTrends {
    const points: TrendPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      points.push({
        date: d.toISOString().split('T')[0],
        averageBiasDelta: +(0.12 + Math.random() * 0.15).toFixed(3),
        averageDebiasedScore: +(0.42 + Math.random() * 0.1).toFixed(3),
        totalAnalyzed: 2 + Math.floor(Math.random() * 5),
        biasFlaggedCount: Math.floor(Math.random() * 3),
      });
    }
    return { points };
  }

  private mockSurveyCompletionStats(): SurveyCompletionStats {
    const recentCompletions: { date: string; completedCount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      recentCompletions.push({
        date: d.toISOString().split('T')[0],
        completedCount: 1 + Math.floor(Math.random() * 5),
      });
    }
    return {
      totalSessions: 42,
      completedSessions: 36,
      inProgressSessions: 6,
      completionRate: 0.857,
      avgAccuracy: 0.6833,
      avgItemsPerSession: 10,
      byMode: [
        { mode: 'Solo', sessions: 20, avgAccuracy: 0.625 },
        { mode: 'Human-AI Collab', sessions: 16, avgAccuracy: 0.75 },
      ],
      byDifficulty: [
        { difficulty: 'Easy', total: 120, correct: 96, accuracy: 0.80 },
        { difficulty: 'Medium', total: 120, correct: 78, accuracy: 0.65 },
        { difficulty: 'Hard', total: 120, correct: 60, accuracy: 0.50 },
      ],
      recentCompletions,
    };
  }
}

/**
 * Trending Service — manages trending topics and circuit breaker state.
 *
 * Provides:
 * - Get trending topics with trust scores and circuit breaker status
 * - Record engagement events
 * - Manual circuit break/release
 * - Trend alerts
 * - Mock mode for demo/development
 */
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from './environment';
import {
  TrendingTopic,
  TrendAlert,
  TrendingResponse,
} from '../models/analysis.model';

@Injectable({ providedIn: 'root' })
export class TrendingService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBase;

  /** Reactive state for trending topics. */
  private _topics = signal<TrendingTopic[]>([]);
  private _alerts = signal<TrendAlert[]>([]);

  topics = this._topics.asReadonly();
  alerts = this._alerts.asReadonly();

  /** Count of circuit-broken trends. */
  brokenCount = computed(() => this._topics().filter(t => t.circuitBroken).length);

  /** Count of trending topics with warnings. */
  warningCount = computed(() =>
    this._topics().filter(t => t.breakSeverity === 'warning' || t.breakSeverity === 'critical').length
  );

  /** Average trust score across all trending topics. */
  avgTrustScore = computed(() => {
    const topics = this._topics();
    if (topics.length === 0) return 100;
    return topics.reduce((sum, t) => sum + t.trustScore, 0) / topics.length;
  });

  /** Load trending topics. */
  loadTrending(): void {
    if (environment.mockMode) {
      this._topics.set(this._mockTopics());
      this._alerts.set(this._mockAlerts());
      return;
    }
    this.http.get<TrendingResponse>(`${this.baseUrl}/trending`)
      .pipe(catchError(() => of({ topics: this._mockTopics(), alerts: this._mockAlerts() })))
      .subscribe(res => {
        this._topics.set(res.topics);
        this._alerts.set(res.alerts);
      });
  }

  /** Record a new engagement on a topic. */
  recordEngagement(topic: string, postId: string, isAi: boolean): Observable<any> {
    if (environment.mockMode) {
      return of({ status: 'ok' });
    }
    return this.http.post(`${this.baseUrl}/trending/engage`, {
      topic, postId, isAiContent: isAi, engagementType: 'post',
    }).pipe(catchError(() => of({ status: 'mock' })));
  }

  /** Manual circuit break on a topic. */
  circuitBreak(topic: string, reason: string): Observable<any> {
    if (environment.mockMode) {
      this._topics.update(topics =>
        topics.map(t =>
          t.topic.toLowerCase() === topic.toLowerCase()
            ? { ...t, circuitBroken: true, breakSeverity: 'broken' as const, breakReason: reason, correctiveActions: ['CIRCUIT BROKEN — Trend suppressed', 'Under Review'] }
            : t
        )
      );
      return of({ status: 'broken' });
    }
    return this.http.post(`${this.baseUrl}/trending/circuit-break`, null, {
      params: { topic, reason },
    }).pipe(
      tap(() => this.loadTrending()),
      catchError(() => of({ status: 'mock' }))
    );
  }

  // ── Mock data ─────────────────────────────────────────────────────────────

  private _mockTopics(): TrendingTopic[] {
    const now = new Date().toISOString();
    return [
      {
        topic: '#ClimateAction',
        postCount: 12, engagementCount: 48, velocity: 0.25,
        aiContentRatio: 0.167, uniqueAuthors: 10, coordinationScore: 0.05,
        trustScore: 92, circuitBroken: false, breakReason: '',
        breakSeverity: 'none', correctiveActions: [],
        firstSeen: now, lastUpdated: now,
      },
      {
        topic: '#CryptoMoon',
        postCount: 20, engagementCount: 65, velocity: 4.0,
        aiContentRatio: 0.80, uniqueAuthors: 3, coordinationScore: 0.85,
        trustScore: 12, circuitBroken: true,
        breakReason: 'AI content flood: 80% of posts are AI-generated. Coordinated amplification detected (score: 85%)',
        breakSeverity: 'broken',
        correctiveActions: [
          'CIRCUIT BROKEN — Trend suppressed from feeds',
          'Label as "AI-Driven Trend" in feed',
          'Demote from organic trending algorithms',
          'Review for coordinated inauthentic behavior',
          'Investigate accounts for bot indicators',
          'All posts under this topic labeled "Under Review"',
        ],
        firstSeen: now, lastUpdated: now,
      },
      {
        topic: '#BuyProductX',
        postCount: 15, engagementCount: 42, velocity: 7.5,
        aiContentRatio: 0.667, uniqueAuthors: 2, coordinationScore: 0.92,
        trustScore: 18, circuitBroken: true,
        breakReason: 'Coordinated amplification detected. Low author diversity.',
        breakSeverity: 'broken',
        correctiveActions: [
          'CIRCUIT BROKEN — Trend suppressed from feeds',
          'Review for coordinated inauthentic behavior',
          'Investigate accounts for bot indicators',
        ],
        firstSeen: now, lastUpdated: now,
      },
      {
        topic: '#LocalNews',
        postCount: 8, engagementCount: 24, velocity: 0.07,
        aiContentRatio: 0.0, uniqueAuthors: 8, coordinationScore: 0.02,
        trustScore: 98, circuitBroken: false, breakReason: '',
        breakSeverity: 'none', correctiveActions: [],
        firstSeen: now, lastUpdated: now,
      },
      {
        topic: '#TechInnovation',
        postCount: 10, engagementCount: 30, velocity: 0.4,
        aiContentRatio: 0.40, uniqueAuthors: 8, coordinationScore: 0.12,
        trustScore: 72, circuitBroken: false, breakReason: '',
        breakSeverity: 'watch',
        correctiveActions: ['Display AI content ratio on topic page'],
        firstSeen: now, lastUpdated: now,
      },
      {
        topic: '#AIArt',
        postCount: 25, engagementCount: 120, velocity: 1.2,
        aiContentRatio: 0.72, uniqueAuthors: 15, coordinationScore: 0.15,
        trustScore: 45, circuitBroken: false, breakReason: '',
        breakSeverity: 'warning',
        correctiveActions: [
          'Display AI content ratio on topic page',
          'Show "AI-Dominant Content" advisory',
        ],
        firstSeen: now, lastUpdated: now,
      },
      {
        topic: '#BreakingNews',
        postCount: 30, engagementCount: 200, velocity: 2.5,
        aiContentRatio: 0.23, uniqueAuthors: 25, coordinationScore: 0.08,
        trustScore: 85, circuitBroken: false, breakReason: '',
        breakSeverity: 'none', correctiveActions: [],
        firstSeen: now, lastUpdated: now,
      },
      {
        topic: '#HealthTips',
        postCount: 18, engagementCount: 55, velocity: 0.3,
        aiContentRatio: 0.55, uniqueAuthors: 12, coordinationScore: 0.20,
        trustScore: 58, circuitBroken: false, breakReason: '',
        breakSeverity: 'warning',
        correctiveActions: ['Display AI content ratio on topic page'],
        firstSeen: now, lastUpdated: now,
      },
    ];
  }

  private _mockAlerts(): TrendAlert[] {
    const now = new Date().toISOString();
    return [
      {
        topic: '#CryptoMoon', alertType: 'ai_flood', severity: 'critical',
        message: 'AI content flood: 80% of posts are AI-generated',
        evidence: ['16 of 20 posts flagged as AI', 'Trend may be artificially manufactured'],
        recommendedAction: 'Apply "AI-Driven Trend" label; suppress from organic trending',
        timestamp: now,
      },
      {
        topic: '#CryptoMoon', alertType: 'coordination', severity: 'critical',
        message: 'Coordinated amplification detected (score: 85%)',
        evidence: ['Burst pattern suggests organized campaign', 'Coordination score: 0.85'],
        recommendedAction: 'Flag for human moderation review',
        timestamp: now,
      },
      {
        topic: '#BuyProductX', alertType: 'coordination', severity: 'critical',
        message: 'Coordinated amplification detected (score: 92%)',
        evidence: ['Very regular posting intervals', 'Only 2 unique authors'],
        recommendedAction: 'Investigate for bot accounts',
        timestamp: now,
      },
      {
        topic: '#HealthTips', alertType: 'ai_flood', severity: 'warning',
        message: 'High AI content ratio: 55%',
        evidence: ['10 of 18 posts flagged as AI'],
        recommendedAction: 'Monitor closely; add AI content advisory',
        timestamp: now,
      },
    ];
  }
}

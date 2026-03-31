/**
 * ExposureTrackerService — Feedback monitoring & circuit breakers (TrustFeed proposal §Overview).
 *
 * Tracks how exposure to AI content shifts user judgments over time via micro-probes.
 * If bias amplification is detected, triggers circuit breakers (exposure caps, diversity constraints).
 */
import { Injectable, signal, computed } from '@angular/core';
import { CircuitBreakerState } from '../models/post.model';

export interface ExposureEvent {
  postId: string;
  contentType: 'text' | 'image' | 'video';
  isAiGenerated: boolean;
  biasLevel: number;          // 0-1
  timestamp: Date;
  userVoteBefore?: 'ai' | 'human' | null;
  userVoteAfter?: 'ai' | 'human' | null;
}

export interface JudgmentDrift {
  /** How much the user's AI detection accuracy has shifted. Positive = better, negative = worse. */
  accuracyShift: number;
  /** How many of the user's recent votes aligned with the majority. */
  alignmentRate: number;
  /** Whether the user is increasingly voting 'ai' over time. */
  aiSuspicionTrend: number;
  /** Number of consecutive AI-content exposures. */
  consecutiveAiExposures: number;
  /** Overall drift level for display. */
  level: 'stable' | 'mild-drift' | 'moderate-drift' | 'significant-drift';
}

@Injectable({ providedIn: 'root' })
export class ExposureTrackerService {
  private readonly EXPOSURE_CAP = 10;
  private readonly DIVERSITY_THRESHOLD = 0.3;
  private readonly DRIFT_WINDOW = 20; // last N events to compute drift

  private exposureLog = signal<ExposureEvent[]>([]);
  private _circuitBreaker = signal<CircuitBreakerState>({
    triggered: false,
    reason: '',
    exposureCount: 0,
    exposureCap: 10,
    diversityScore: 1.0,
    diversityThreshold: 0.3,
    cooldownActive: false,
  });

  circuitBreaker = this._circuitBreaker.asReadonly();

  /** Computed judgment drift from micro-probe data. */
  judgmentDrift = computed<JudgmentDrift>(() => {
    const log = this.exposureLog();
    const recent = log.slice(-this.DRIFT_WINDOW);
    if (recent.length < 3) {
      return { accuracyShift: 0, alignmentRate: 1, aiSuspicionTrend: 0, consecutiveAiExposures: 0, level: 'stable' };
    }

    // Count consecutive AI exposures at end of log
    let consecutive = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].isAiGenerated) consecutive++;
      else break;
    }

    // AI suspicion trend: ratio of 'ai' votes in recent window
    const voted = recent.filter(e => e.userVoteAfter);
    const aiVotes = voted.filter(e => e.userVoteAfter === 'ai').length;
    const aiSuspicion = voted.length > 0 ? aiVotes / voted.length : 0.5;

    // Accuracy: did their vote match the author declaration?
    const correct = voted.filter(e =>
      (e.isAiGenerated && e.userVoteAfter === 'ai') || (!e.isAiGenerated && e.userVoteAfter === 'human')
    ).length;
    const accuracy = voted.length > 0 ? correct / voted.length : 0.5;
    const accuracyShift = accuracy - 0.5; // positive is above chance

    // Drift severity
    let level: JudgmentDrift['level'] = 'stable';
    if (consecutive >= 7 || aiSuspicion > 0.85) level = 'significant-drift';
    else if (consecutive >= 5 || aiSuspicion > 0.7) level = 'moderate-drift';
    else if (consecutive >= 3 || aiSuspicion > 0.6) level = 'mild-drift';

    return {
      accuracyShift,
      alignmentRate: accuracy,
      aiSuspicionTrend: aiSuspicion,
      consecutiveAiExposures: consecutive,
      level,
    };
  });

  /** Total AI-content exposures this session. */
  aiExposureCount = computed(() =>
    this.exposureLog().filter(e => e.isAiGenerated).length
  );

  /** Record that the user saw a post (scrolled into view). */
  recordExposure(postId: string, contentType: 'text' | 'image' | 'video', isAiGenerated: boolean, biasLevel: number): void {
    // Deduplicate — don't re-record same post
    if (this.exposureLog().some(e => e.postId === postId)) return;

    this.exposureLog.update(log => [...log, {
      postId, contentType, isAiGenerated, biasLevel,
      timestamp: new Date(),
    }]);

    this._evaluateCircuitBreaker();
  }

  /** Record a micro-probe result: the user's vote on a post (before/after exposure comparison). */
  recordVote(postId: string, vote: 'ai' | 'human'): void {
    this.exposureLog.update(log => log.map(e =>
      e.postId === postId ? { ...e, userVoteAfter: vote } : e
    ));
    this._evaluateCircuitBreaker();
  }

  /** User acknowledged the circuit breaker interstitial. */
  acknowledgeCooldown(): void {
    this._circuitBreaker.update(cb => ({ ...cb, cooldownActive: false }));
  }

  /** Reset session tracking (e.g. if user navigates away and back). */
  resetSession(): void {
    this.exposureLog.set([]);
    this._circuitBreaker.set({
      triggered: false, reason: '', exposureCount: 0, exposureCap: this.EXPOSURE_CAP,
      diversityScore: 1.0, diversityThreshold: this.DIVERSITY_THRESHOLD, cooldownActive: false,
    });
  }

  private _evaluateCircuitBreaker(): void {
    const log = this.exposureLog();
    const aiCount = log.filter(e => e.isAiGenerated).length;
    const totalCount = log.length;

    // Diversity score: ratio of non-AI content
    const diversity = totalCount > 0 ? (totalCount - aiCount) / totalCount : 1.0;

    // Check triggers
    const exposureExceeded = aiCount >= this.EXPOSURE_CAP;
    const diversityLow = diversity < this.DIVERSITY_THRESHOLD;
    const drift = this.judgmentDrift();
    const driftTriggered = drift.level === 'significant-drift' || drift.level === 'moderate-drift';

    const triggered = exposureExceeded || diversityLow || driftTriggered;
    let reason = '';
    if (exposureExceeded) reason = `You've viewed ${aiCount} AI-generated posts this session. Taking a break helps calibrate your judgment.`;
    else if (diversityLow) reason = `Your recent feed is ${((1 - diversity) * 100).toFixed(0)}% AI content. Diversifying helps maintain balanced judgment.`;
    else if (driftTriggered) reason = `Your voting pattern suggests increasing AI suspicion. A pause can help recalibrate.`;

    this._circuitBreaker.set({
      triggered,
      reason,
      exposureCount: aiCount,
      exposureCap: this.EXPOSURE_CAP,
      diversityScore: diversity,
      diversityThreshold: this.DIVERSITY_THRESHOLD,
      cooldownActive: triggered && !this._circuitBreaker().cooldownActive ? true : this._circuitBreaker().cooldownActive,
    });
  }
}

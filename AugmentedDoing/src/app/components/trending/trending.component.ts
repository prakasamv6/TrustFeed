/**
 * TrendingComponent — Trending topics dashboard with circuit breaker visualization.
 *
 * Features:
 * - Live trending topics with trust scores and AI content ratios
 * - Circuit breaker status indicators (healthy, watch, warning, critical, broken)
 * - Alert timeline for trend anomalies
 * - Corrective action display
 * - Manual circuit break control
 * - Visual severity coding integrated with TrustFeed design tokens
 */
import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, PercentPipe, UpperCasePipe } from '@angular/common';
import { TrendingService } from '../../services/trending.service';
import { AiFlagService } from '../../services/ai-flag.service';
import { TrendingTopic, TrendAlert } from '../../models/analysis.model';

@Component({
  selector: 'app-trending',
  standalone: true,
  imports: [DecimalPipe, PercentPipe, UpperCasePipe],
  templateUrl: './trending.component.html',
  styleUrl: './trending.component.scss',
})
export class TrendingComponent implements OnInit {
  trendingService = inject(TrendingService);
  flagService = inject(AiFlagService);

  selectedTopic = signal<TrendingTopic | null>(null);
  showAlerts = signal(true);

  ngOnInit(): void {
    this.trendingService.loadTrending();
  }

  selectTopic(topic: TrendingTopic): void {
    this.selectedTopic.set(
      this.selectedTopic()?.topic === topic.topic ? null : topic
    );
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'broken': return 'severity-broken';
      case 'critical': return 'severity-critical';
      case 'warning': return 'severity-warning';
      case 'watch': return 'severity-watch';
      default: return 'severity-healthy';
    }
  }

  getSeverityLabel(severity: string): string {
    switch (severity) {
      case 'broken': return 'CIRCUIT BROKEN';
      case 'critical': return 'CRITICAL';
      case 'warning': return 'WARNING';
      case 'watch': return 'WATCH';
      default: return 'HEALTHY';
    }
  }

  getTrustBarWidth(score: number): string {
    return `${Math.max(0, Math.min(100, score))}%`;
  }

  getTrustColor(score: number): string {
    if (score >= 80) return 'var(--status-confirm, #2ea043)';
    if (score >= 60) return 'var(--accent-primary, #58a6ff)';
    if (score >= 40) return 'var(--status-notice, #d4a054)';
    return 'var(--status-critical, #f85149)';
  }

  getAiRatioWidth(ratio: number): string {
    return `${Math.max(0, Math.min(100, ratio * 100))}%`;
  }

  getAiRatioColor(ratio: number): string {
    if (ratio >= 0.75) return 'var(--status-critical, #f85149)';
    if (ratio >= 0.50) return 'var(--status-notice, #d4a054)';
    if (ratio >= 0.25) return 'var(--accent-primary, #58a6ff)';
    return 'var(--status-confirm, #2ea043)';
  }

  manualBreak(topic: TrendingTopic): void {
    this.trendingService.circuitBreak(topic.topic, 'Manual review — flagged by moderator')
      .subscribe(() => {
        this.trendingService.loadTrending();
      });
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'velocity_spike': return '⚡';
      case 'ai_flood': return '🤖';
      case 'coordination': return '🔗';
      case 'low_diversity': return '👥';
      case 'bot_pattern': return '🤖';
      default: return '⚠️';
    }
  }
}

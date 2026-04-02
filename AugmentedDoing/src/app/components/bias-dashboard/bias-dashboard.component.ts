import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, PercentPipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { PostService } from '../../services/post.service';
import { FairnessSurveyService } from '../../services/fairness-survey.service';
import {
  DashboardSummary, DashboardAgentStats, DashboardTrends,
  FairnessTrends,
} from '../../models/dashboard.model';
import {
  FactorAttributionReport, FairnessSurveySummary,
} from '../../models/analysis.model';
import { Post } from '../../models/post.model';

interface SurveyRatings {
  originalFairness: number;
  nonbiasedFairness: number;
  explanationClarity: number;
  trustImpact: number;
  perceivedBiasSeverity: number;
  [key: string]: number;
}

@Component({
  selector: 'app-bias-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, PercentPipe],
  templateUrl: './bias-dashboard.component.html',
  styleUrl: './bias-dashboard.component.scss',
})
export class BiasDashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private postService = inject(PostService);
  private fairnessService = inject(FairnessSurveyService);

  summary = signal<DashboardSummary | null>(null);
  agentStats = signal<DashboardAgentStats | null>(null);
  trends = signal<DashboardTrends | null>(null);
  fairnessTrends = signal<FairnessTrends | null>(null);

  // Selected post for drill-down
  selectedPost = signal<Post | null>(null);
  factorAttribution = signal<FactorAttributionReport | null>(null);
  fairnessSummary = signal<FairnessSurveySummary | null>(null);

  // Fairness survey state
  surveyRatings = signal<SurveyRatings>({
    originalFairness: 0,
    nonbiasedFairness: 0,
    explanationClarity: 0,
    trustImpact: 0,
    perceivedBiasSeverity: 0,
  });
  surveyComment = signal('');
  surveySubmitted = signal(false);

  surveyQuestions = [
    { key: 'originalFairness', label: 'The original (biased) result was fair and reasonable' },
    { key: 'nonbiasedFairness', label: 'The non-biased baseline result was more equitable' },
    { key: 'explanationClarity', label: 'The bias explanation was clear and understandable' },
    { key: 'trustImpact', label: 'This analysis increased my trust in the system' },
    { key: 'perceivedBiasSeverity', label: 'The detected bias appears significant and concerning' },
  ];

  ngOnInit(): void {
    this.dashboardService.getSummary().subscribe(s => this.summary.set(s));
    this.dashboardService.getAgentStats().subscribe(s => this.agentStats.set(s));
    this.dashboardService.getTrends().subscribe(t => this.trends.set(t));
    this.fairnessService.getFairnessTrends().subscribe(t => this.fairnessTrends.set(t));

    // Auto-select first flagged post if available
    const flagged = this.getFlaggedPosts();
    if (flagged.length > 0) {
      this.selectPost(flagged[0]);
    }
  }

  selectPost(post: Post): void {
    this.selectedPost.set(post);
    this.surveySubmitted.set(false);
    this.surveyRatings.set({
      originalFairness: 0, nonbiasedFairness: 0, explanationClarity: 0,
      trustImpact: 0, perceivedBiasSeverity: 0,
    });
    this.surveyComment.set('');

    // Load factor attribution (mock) and fairness survey results
    const attribution = this.fairnessService.generateMockAttribution(post.id);
    this.factorAttribution.set(attribution);

    this.fairnessService.getSurveyResults(post.id).subscribe(result => {
      this.fairnessSummary.set(result.summary);
    });
  }

  getConfidenceDelta(): number {
    const post = this.selectedPost();
    if (!post?.biasResult) return 0;
    const scores = post.biasResult;
    return Math.abs(scores.rawBiasedScore - scores.baselineNonbiasedScore);
  }

  getFactorBarWidth(pct: number): number {
    return Math.min(100, Math.max(2, pct));
  }

  setSurveyRating(key: string, value: number): void {
    this.surveyRatings.update(r => ({ ...r, [key]: value }));
  }

  canSubmitSurvey(): boolean {
    const r = this.surveyRatings();
    return Object.values(r).every(v => v >= 1 && v <= 5);
  }

  submitFairnessSurvey(): void {
    const post = this.selectedPost();
    if (!post) return;

    const r = this.surveyRatings();
    this.fairnessService.submitSurvey({
      postId: post.id,
      originalFairness: r['originalFairness'],
      nonbiasedFairness: r['nonbiasedFairness'],
      explanationClarity: r['explanationClarity'],
      trustImpact: r['trustImpact'],
      perceivedBiasSeverity: r['perceivedBiasSeverity'],
      comment: this.surveyComment(),
    }).subscribe(() => {
      this.surveySubmitted.set(true);
      // Refresh survey results
      this.fairnessService.getSurveyResults(post.id).subscribe(result => {
        this.fairnessSummary.set(result.summary);
      });
    });
  }

  resetSurvey(): void {
    this.surveySubmitted.set(false);
    this.surveyRatings.set({
      originalFairness: 0, nonbiasedFairness: 0, explanationClarity: 0,
      trustImpact: 0, perceivedBiasSeverity: 0,
    });
    this.surveyComment.set('');
  }

  getModalityEntries(): [string, number][] {
    const s = this.summary();
    if (!s) return [];
    return Object.entries(s.modalityBreakdown);
  }

  getModalityPercent(count: number): number {
    const s = this.summary();
    if (!s) return 0;
    const total = Object.values(s.modalityBreakdown).reduce((a, b) => a + b, 0);
    return total > 0 ? (count / total) * 100 : 0;
  }

  getModalityColor(mod: string): string {
    switch (mod) {
      case 'text': return 'var(--accent-primary)';
      case 'image': return 'var(--accent-secondary)';
      case 'video': return 'var(--status-notice)';
      default: return 'var(--text-muted)';
    }
  }

  getFavColor(rate: number): string {
    if (rate >= 0.5) return 'var(--status-critical)';
    if (rate >= 0.3) return 'var(--status-notice)';
    return 'var(--status-confirm)';
  }

  getFlaggedPosts(): Post[] {
    return this.postService.getAllPosts().filter(p => p.biasResult?.favoritismFlag);
  }

  exportJSON(): void {
    const data = {
      summary: this.summary(),
      agentStats: this.agentStats(),
      trends: this.trends(),
      fairnessTrends: this.fairnessTrends(),
      factorAttribution: this.factorAttribution(),
      flaggedPosts: this.getFlaggedPosts().map(p => ({
        id: p.id, author: p.author.name, contentType: p.contentType,
        ...p.biasResult,
      })),
    };
    this.downloadFile(JSON.stringify(data, null, 2), 'bias-intelligence-report.json', 'application/json');
  }

  exportCSV(): void {
    const posts = this.getFlaggedPosts();
    const header = 'PostID,Author,ContentType,RawBiased,Baseline,Debiased,BiasDelta,DominantAgent,FavoredRegion\n';
    const rows = posts.map(p => {
      const b = p.biasResult!;
      return `${p.id},${p.author.name},${p.contentType},${b.rawBiasedScore},${b.baselineNonbiasedScore},${b.debiasedAdjustedScore},${b.biasDelta},${b.dominantBiasedAgent},${b.favoredRegion}`;
    }).join('\n');
    this.downloadFile(header + rows, 'bias-intelligence-report.csv', 'text/csv');
  }

  private downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}

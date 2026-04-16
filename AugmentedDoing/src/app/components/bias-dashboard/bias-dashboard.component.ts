import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe, PercentPipe, TitleCasePipe, DatePipe, SlicePipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { PostService } from '../../services/post.service';
import { FairnessSurveyService } from '../../services/fairness-survey.service';
import {
  DashboardSummary, DashboardAgentStats, DashboardTrends,
  FairnessTrends, SurveyCompletionStats,
  AgentTrackingResponse, AnalyticsResponse,
  DbSurveySession,
} from '../../models/dashboard.model';
import {
  FactorAttributionReport, FairnessSurveySummary,
} from '../../models/analysis.model';
import { Post } from '../../models/post.model';
import { SurveyService } from '../../services/survey.service';

type ReportTab = 'overview' | 'agents' | 'survey' | 'bias' | 'logs';

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
  imports: [DecimalPipe, PercentPipe, TitleCasePipe, DatePipe, SlicePipe],
  templateUrl: './bias-dashboard.component.html',
  styleUrl: './bias-dashboard.component.scss',
})
export class BiasDashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private postService = inject(PostService);
  private fairnessService = inject(FairnessSurveyService);
  private surveyService = inject(SurveyService);

  /** In-memory completed survey sessions */
  surveySessions = computed(() => this.surveyService.allResults());

  /** DB-persisted survey sessions from SurveyApp MySQL */
  dbSessions = signal<DbSurveySession[]>([]);

  // Tab navigation
  activeTab = signal<ReportTab>('overview');
  tabs: { id: ReportTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'agents', label: 'Agent Reports', icon: '⬡' },
    { id: 'survey', label: 'Survey Research', icon: '◉' },
    { id: 'bias', label: 'Bias Analysis', icon: '△' },
    { id: 'logs', label: 'Audit Trail', icon: '≡' },
  ];

  // Data signals
  summary = signal<DashboardSummary | null>(null);
  agentStats = signal<DashboardAgentStats | null>(null);
  trends = signal<DashboardTrends | null>(null);
  fairnessTrends = signal<FairnessTrends | null>(null);
  surveyCompletionStats = signal<SurveyCompletionStats | null>(null);
  agentTracking = signal<AgentTrackingResponse | null>(null);
  analytics = signal<AnalyticsResponse | null>(null);
  dbConnected = signal(false);
  loading = signal(true);
  currentYear = new Date().getFullYear();

  // Post drill-down
  selectedPost = signal<Post | null>(null);
  factorAttribution = signal<FactorAttributionReport | null>(null);
  fairnessSummary = signal<FairnessSurveySummary | null>(null);

  // Fairness survey
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

  // Computed
  totalDataPoints = computed(() => {
    const at = this.agentTracking();
    return (at?.totalFeedAnalyses ?? 0) + (at?.totalSurveyVerdicts ?? 0);
  });

  ngOnInit(): void {
    let loadCount = 0;
    const checkLoaded = () => { if (++loadCount >= 3) this.loading.set(false); };

    this.dashboardService.getSummary().subscribe(s => this.summary.set(s));
    this.dashboardService.getAgentStats().subscribe(s => this.agentStats.set(s));
    this.dashboardService.getTrends().subscribe(t => this.trends.set(t));
    this.fairnessService.getFairnessTrends().subscribe(t => this.fairnessTrends.set(t));
    this.dashboardService.getSurveyCompletionStats().subscribe(s => { this.surveyCompletionStats.set(s); checkLoaded(); });

    this.dashboardService.getAgentTracking().subscribe(t => {
      this.agentTracking.set(t);
      this.dbConnected.set(t.totalFeedAnalyses > 0 || t.totalSurveyVerdicts > 0);
      checkLoaded();
    });
    this.dashboardService.getAnalytics().subscribe(a => { this.analytics.set(a); checkLoaded(); });

    this.dashboardService.getDbSessions().subscribe(sessions => this.dbSessions.set(sessions));

    const flagged = this.getFlaggedPosts();
    if (flagged.length > 0) this.selectPost(flagged[0]);
  }

  setTab(tab: ReportTab): void { this.activeTab.set(tab); }

  selectPost(post: Post): void {
    this.selectedPost.set(post);
    this.surveySubmitted.set(false);
    this.surveyRatings.set({ originalFairness: 0, nonbiasedFairness: 0, explanationClarity: 0, trustImpact: 0, perceivedBiasSeverity: 0 });
    this.surveyComment.set('');
    this.factorAttribution.set(this.fairnessService.generateMockAttribution(post.id));
    this.fairnessService.getSurveyResults(post.id).subscribe(result => this.fairnessSummary.set(result.summary));
  }

  getConfidenceDelta(): number {
    const post = this.selectedPost();
    if (!post?.biasResult) return 0;
    return Math.abs(post.biasResult.rawBiasedScore - post.biasResult.baselineNonbiasedScore);
  }

  getFactorBarWidth(pct: number): number { return Math.min(100, Math.max(2, pct)); }

  setSurveyRating(key: string, value: number): void { this.surveyRatings.update(r => ({ ...r, [key]: value })); }
  canSubmitSurvey(): boolean { return Object.values(this.surveyRatings()).every(v => v >= 1 && v <= 5); }

  submitFairnessSurvey(): void {
    const post = this.selectedPost();
    if (!post) return;
    const r = this.surveyRatings();
    this.fairnessService.submitSurvey({
      postId: post.id, originalFairness: r['originalFairness'], nonbiasedFairness: r['nonbiasedFairness'],
      explanationClarity: r['explanationClarity'], trustImpact: r['trustImpact'],
      perceivedBiasSeverity: r['perceivedBiasSeverity'], comment: this.surveyComment(),
    }).subscribe(() => {
      this.surveySubmitted.set(true);
      this.fairnessService.getSurveyResults(post.id).subscribe(result => this.fairnessSummary.set(result.summary));
    });
  }

  resetSurvey(): void {
    this.surveySubmitted.set(false);
    this.surveyRatings.set({ originalFairness: 0, nonbiasedFairness: 0, explanationClarity: 0, trustImpact: 0, perceivedBiasSeverity: 0 });
    this.surveyComment.set('');
  }

  getModalityEntries(): [string, number][] {
    const s = this.summary();
    return s ? Object.entries(s.modalityBreakdown) : [];
  }

  getModalityPercent(count: number): number {
    const s = this.summary();
    if (!s) return 0;
    const total = Object.values(s.modalityBreakdown).reduce((a, b) => a + b, 0);
    return total > 0 ? (count / total) * 100 : 0;
  }

  getModalityColor(mod: string): string {
    return mod === 'text' ? 'var(--accent-primary)' : mod === 'image' ? 'var(--accent-secondary)' : 'var(--status-notice)';
  }

  getFavColor(rate: number): string {
    return rate >= 0.5 ? 'var(--status-critical)' : rate >= 0.3 ? 'var(--status-notice)' : 'var(--status-confirm)';
  }

  getAccuracyColor(accuracy: number): string {
    return accuracy >= 0.75 ? 'var(--status-confirm)' : accuracy >= 0.6 ? 'var(--status-notice)' : 'var(--status-critical)';
  }

  getRegionEmoji(region: string): string {
    const m: Record<string, string> = { Africa: '🌍', Asia: '🌏', Europe: '🌍', North_America: '🌎', South_America: '🌎', Antarctica: '🧊', Australia: '🦘', Americas: '🌎', Oceania: '🌏' };
    return m[region] || '🌐';
  }

  getFlaggedPosts(): Post[] { return this.postService.getAllPosts().filter(p => p.biasResult?.favoritismFlag); }

  getAvgBiasDelta(): number {
    const stats = this.agentTracking()?.feedAnalysis.agentStats;
    if (!stats?.length) return 0;
    return stats.reduce((s, a) => s + (+a.avg_bias_delta || 0), 0) / stats.length;
  }

  getAvgConfidence(): number {
    const stats = this.agentTracking()?.feedAnalysis.agentStats;
    if (!stats?.length) return 0;
    return stats.reduce((s, a) => s + (+a.avg_confidence || 0), 0) / stats.length;
  }

  getAvgStdDev(): number {
    const stats = this.agentTracking()?.feedAnalysis.agentStats;
    if (!stats?.length) return 0;
    return stats.reduce((s, a) => s + (+a.score_stddev || 0), 0) / stats.length;
  }

  getHighestScoringAgent(): string {
    const stats = this.agentTracking()?.feedAnalysis.agentStats;
    if (!stats?.length) return '—';
    const best = stats.reduce((a, b) => +a.avg_score > +b.avg_score ? a : b);
    return best.agent_region;
  }

  getMostAccurateRegion(): string {
    const verdicts = this.agentTracking()?.surveyVerdicts;
    if (!verdicts?.length) return '—';
    const best = verdicts.reduce((a, b) => +a.accuracy > +b.accuracy ? a : b);
    return best.agent_region;
  }

  getOverallAccuracy(): number {
    const verdicts = this.agentTracking()?.surveyVerdicts;
    if (!verdicts?.length) return 0;
    const totalCorrect = verdicts.reduce((s, v) => s + (+v.correct_count || 0), 0);
    const totalVerdicts = verdicts.reduce((s, v) => s + (+v.total_verdicts || 0), 0);
    return totalVerdicts > 0 ? totalCorrect / totalVerdicts : 0;
  }

  exportJSON(): void {
    const data = {
      generatedAt: new Date().toISOString(),
      summary: this.summary(),
      agentTracking: this.agentTracking(),
      analytics: this.analytics(),
      surveyCompletion: this.surveyCompletionStats(),
      agentStats: this.agentStats(),
      trends: this.trends(),
      fairnessTrends: this.fairnessTrends(),
      factorAttribution: this.factorAttribution(),
      flaggedPosts: this.getFlaggedPosts().map(p => ({ id: p.id, author: p.author.name, contentType: p.contentType, ...p.biasResult })),
    };
    this.downloadFile(JSON.stringify(data, null, 2), 'trustfeed-research-report.json', 'application/json');
  }

  exportCSV(): void {
    const posts = this.getFlaggedPosts();
    const header = 'PostID,Author,ContentType,RawBiased,Baseline,Debiased,BiasDelta,DominantAgent,FavoredRegion\n';
    const rows = posts.map(p => {
      const b = p.biasResult!;
      return `${p.id},${p.author.name},${p.contentType},${b.rawBiasedScore},${b.baselineNonbiasedScore},${b.debiasedAdjustedScore},${b.biasDelta},${b.dominantBiasedAgent},${b.favoredRegion}`;
    }).join('\n');
    this.downloadFile(header + rows, 'trustfeed-research-report.csv', 'text/csv');
  }

  private downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Survey Session Analytics ────────────────────────────────────

  /** Combine DB sessions + in-memory sessions (DB sessions take precedence) */
  private getAllSurveySessions(): { sessionId: string; collabMode: boolean; totalItems: number; humanCorrect: number; humanAccuracy: number; humanAiCount: number; humanHumanCount: number; actualAiCount: number; actualHumanCount: number; agentResults: { region: string; correct: number; accuracy: number }[]; source: 'db' | 'memory'; completedAt?: string }[] {
    const dbSess = this.dbSessions().map(s => ({
      sessionId: s.sessionId,
      collabMode: s.collabMode,
      totalItems: s.totalItems ?? 0,
      humanCorrect: s.humanCorrect ?? 0,
      humanAccuracy: s.humanAccuracy ?? 0,
      humanAiCount: s.humanAiCount ?? 0,
      humanHumanCount: s.humanHumanCount ?? 0,
      actualAiCount: s.actualAiCount ?? 0,
      actualHumanCount: s.actualHumanCount ?? 0,
      agentResults: (s.agentResults || []).map(a => ({ region: a.region, correct: a.correct ?? 0, accuracy: a.accuracy ?? 0 })),
      source: 'db' as const,
      completedAt: s.completedAt,
    }));

    // Merge in-memory sessions that aren't already in DB (by sessionId)
    const dbIds = new Set(dbSess.map(s => s.sessionId));
    const memSess = this.surveySessions()
      .filter(s => !dbIds.has(s.sessionId))
      .map(s => ({
        sessionId: s.sessionId,
        collabMode: s.collabMode,
        totalItems: s.totalItems ?? 0,
        humanCorrect: s.humanCorrect ?? 0,
        humanAccuracy: s.humanAccuracy ?? 0,
        humanAiCount: s.humanAiCount ?? 0,
        humanHumanCount: s.humanHumanCount ?? 0,
        actualAiCount: s.actualAiCount ?? 0,
        actualHumanCount: s.actualHumanCount ?? 0,
        agentResults: (s.agentResults || []).map(a => ({ region: a.region, correct: a.correct ?? 0, accuracy: a.accuracy ?? 0 })),
        source: 'memory' as const,
        completedAt: undefined,
      }));

    return [...dbSess, ...memSess];
  }

  getDbSessionCount(): number { return this.dbSessions().length; }
  getMemSessionCount(): number {
    const dbIds = new Set(this.dbSessions().map(s => s.sessionId));
    return this.surveySessions().filter(s => !dbIds.has(s.sessionId)).length;
  }

  getSurveyOverallAccuracy(): number {
    const sessions = this.getAllSurveySessions();
    if (!sessions.length) return 0;
    const total = sessions.reduce((s, r) => s + r.totalItems, 0);
    const correct = sessions.reduce((s, r) => s + r.humanCorrect, 0);
    return total ? correct / total : 0;
  }

  getSurveyTotalItems(): number {
    return this.getAllSurveySessions().reduce((s, r) => s + r.totalItems, 0);
  }

  getSurveyTotalSessions(): number {
    return this.getAllSurveySessions().length;
  }

  getSurveyBestAgentAcc(agentResults: { accuracy: number }[]): number {
    if (!agentResults?.length) return 0;
    return Math.max(...agentResults.map(a => a.accuracy));
  }

  getSurveyAgentAggregate(): { region: string; correct: number; total: number; accuracy: number }[] {
    const map = new Map<string, { correct: number; total: number }>();
    for (const s of this.getAllSurveySessions()) {
      for (const a of (s.agentResults || [])) {
        const cur = map.get(a.region) ?? { correct: 0, total: 0 };
        cur.correct += a.correct;
        cur.total += s.totalItems;
        map.set(a.region, cur);
      }
    }
    return Array.from(map.entries()).map(([region, v]) => ({
      region, correct: v.correct, total: v.total,
      accuracy: v.total ? v.correct / v.total : 0,
    }));
  }

  getAllSurveySessionsForTemplate() {
    return this.getAllSurveySessions();
  }

  // ── Audit Trail helpers ──────────────────────────────────────────────

  auditRegionFilter = signal('');
  auditAgentFilter = signal('');

  getAllAuditSessions() { return this.getAllSurveySessions(); }

  getAuditRegions(): string[] {
    const logs = this.agentTracking()?.feedAnalysis.recentLogs ?? [];
    return [...new Set(logs.map(l => l.agent_region))].sort();
  }

  getAuditAgents(): string[] {
    const logs = this.agentTracking()?.feedAnalysis.recentLogs ?? [];
    return [...new Set(logs.map(l => l.agent_name))].sort();
  }

  getFilteredLogs() {
    const logs = this.agentTracking()?.feedAnalysis.recentLogs ?? [];
    const regionF = this.auditRegionFilter();
    const agentF = this.auditAgentFilter();
    return logs.filter(l =>
      (!regionF || l.agent_region === regionF) &&
      (!agentF  || l.agent_name  === agentF)
    );
  }

  getLogSeverityClass(delta: number): string {
    const d = Math.abs(+delta);
    if (d >= 0.5) return 'sev-high';
    if (d >= 0.2) return 'sev-med';
    return 'sev-low';
  }

  getLogSeverityLabel(delta: number): string {
    const d = Math.abs(+delta);
    if (d >= 0.5) return 'High';
    if (d >= 0.2) return 'Medium';
    return 'Low';
  }

  exportAuditJSON(): void {
    const data = {
      generatedAt: new Date().toISOString(),
      auditType: 'full-audit-trail',
      feedAnalysis: {
        agentStats: this.agentTracking()?.feedAnalysis.agentStats ?? [],
        recentLogs: this.agentTracking()?.feedAnalysis.recentLogs ?? [],
        totalAnalyses: this.agentTracking()?.totalFeedAnalyses ?? 0,
      },
      surveyVerdicts: {
        byAgent: this.agentTracking()?.surveyVerdicts ?? [],
        totalVerdicts: this.agentTracking()?.totalSurveyVerdicts ?? 0,
        overallAccuracy: this.getOverallAccuracy(),
      },
      surveySessions: this.getAllAuditSessions(),
      analytics: this.analytics(),
      summary: this.summary(),
    };
    this.downloadFile(JSON.stringify(data, null, 2), 'trustfeed-full-audit.json', 'application/json');
  }

  exportAuditCSV(): void {
    const logs = this.agentTracking()?.feedAnalysis.recentLogs ?? [];
    const header = 'Timestamp,PostID,AgentName,Region,Score,Confidence,BiasDelta,DisagreementRate,Severity\n';
    const rows = logs.map(l =>
      `${l.created_at},${l.post_id},${l.agent_name},${l.agent_region},${l.score},${l.confidence},${l.bias_delta},${l.disagreement_rate},${this.getLogSeverityLabel(l.bias_delta)}`
    ).join('\n');
    this.downloadFile(header + rows, 'trustfeed-audit-log.csv', 'text/csv');
  }
}

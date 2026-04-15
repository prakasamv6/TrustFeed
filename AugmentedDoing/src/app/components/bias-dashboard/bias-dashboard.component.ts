import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe, PercentPipe, TitleCasePipe, DatePipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { PostService } from '../../services/post.service';
import { FairnessSurveyService } from '../../services/fairness-survey.service';
import {
  DashboardSummary, DashboardAgentStats, DashboardTrends,
  FairnessTrends, SurveyCompletionStats,
  AgentTrackingResponse, AnalyticsResponse,
} from '../../models/dashboard.model';
import {
  FactorAttributionReport, FairnessSurveySummary,
} from '../../models/analysis.model';
import { Post } from '../../models/post.model';

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
  imports: [DecimalPipe, PercentPipe, TitleCasePipe, DatePipe],
  templateUrl: './bias-dashboard.component.html',
  styleUrl: './bias-dashboard.component.scss',
})
export class BiasDashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private postService = inject(PostService);
  private fairnessService = inject(FairnessSurveyService);

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
    const m: Record<string, string> = { Africa: '🌍', Asia: '🌏', Europe: '🌍', Americas: '🌎', Oceania: '🌏' };
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

  exportReport(): void {
    const at = this.agentTracking();
    const sc = this.surveyCompletionStats();
    const an = this.analytics();
    const s = this.summary();
    const t = this.trends();
    const ts = new Date().toISOString();

    const agentRows = (at?.feedAnalysis.agentStats ?? []).map(ag =>
      `<tr><td>${ag.agent_name}</td><td>${ag.agent_region}</td><td>${ag.total_analyses}</td>` +
      `<td>${(+ag.avg_score).toFixed(4)}</td><td>${(+ag.avg_confidence).toFixed(3)}</td>` +
      `<td>${(+ag.avg_bias_delta).toFixed(4)}</td></tr>`
    ).join('');

    const verdictRows = (at?.surveyVerdicts ?? []).map(sv =>
      `<tr><td>${sv.agent_region}</td><td>${sv.correct_count}/${sv.total_verdicts}</td>` +
      `<td>${(+sv.accuracy * 100).toFixed(1)}%</td></tr>`
    ).join('');

    const modeRows = (sc?.byMode ?? []).map(m =>
      `<tr><td>${m.mode}</td><td>${m.sessions}</td><td>${((m.avgAccuracy ?? 0) * 100).toFixed(1)}%</td></tr>`
    ).join('');

    const diffRows = (sc?.byDifficulty ?? []).map(d =>
      `<tr><td>${d.difficulty}</td><td>${d.correct}/${d.total}</td><td>${((d.accuracy ?? 0) * 100).toFixed(0)}%</td></tr>`
    ).join('');

    const trendRows = (t?.points ?? []).map(pt =>
      `<tr><td>${pt.date}</td><td>${pt.totalAnalyzed}</td><td>${pt.biasFlaggedCount}</td>` +
      `<td>${pt.averageBiasDelta.toFixed(3)}</td><td>${pt.averageDebiasedScore.toFixed(3)}</td></tr>`
    ).join('');

    const categoryRows = (an?.accuracyByCategory ?? []).map((c: any) =>
      `<tr><td>${c.item_category}</td><td>${c.correct}/${c.total}</td><td>${(+c.accuracy * 100).toFixed(1)}%</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>TrustFeed Research Report</title>
<style>
  body{font-family:system-ui,sans-serif;margin:2rem;color:#1a1a2e;line-height:1.6}
  h1{color:#0f3460;border-bottom:3px solid #0f3460;padding-bottom:.5rem}
  h2{color:#16213e;margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.3rem}
  table{border-collapse:collapse;width:100%;margin:.75rem 0}
  th,td{border:1px solid #ddd;padding:.5rem .75rem;text-align:left;font-size:.9rem}
  th{background:#f0f4f8;font-weight:600}
  .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin:1rem 0}
  .kpi-box{background:#f8f9fb;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;text-align:center}
  .kpi-box .val{font-size:1.5rem;font-weight:700;color:#0f3460}
  .kpi-box .lbl{font-size:.8rem;color:#666}
  .footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #ddd;font-size:.8rem;color:#888}
  .section-note{font-size:.85rem;color:#555;font-style:italic}
</style></head><body>
<h1>TrustFeed Research Report</h1>
<p class="section-note">Generated: ${ts}</p>

<h2>Executive Summary</h2>
<div class="kpi-grid">
  <div class="kpi-box"><div class="val">${at?.totalFeedAnalyses ?? 0}</div><div class="lbl">Feed Analyses</div></div>
  <div class="kpi-box"><div class="val">${at?.totalSurveyVerdicts ?? 0}</div><div class="lbl">Survey Verdicts</div></div>
  <div class="kpi-box"><div class="val">${at?.feedAnalysis.agentStats.length ?? 0}</div><div class="lbl">Active Agents</div></div>
  <div class="kpi-box"><div class="val">${this.getAvgBiasDelta().toFixed(4)}</div><div class="lbl">Avg Bias Delta</div></div>
  <div class="kpi-box"><div class="val">${this.getAvgConfidence().toFixed(3)}</div><div class="lbl">Avg Confidence</div></div>
  <div class="kpi-box"><div class="val">${(this.getOverallAccuracy() * 100).toFixed(1)}%</div><div class="lbl">Overall Accuracy</div></div>
</div>

${s && s.totalAnalyzedPosts > 0 ? `<h2>Session Analytics</h2>
<div class="kpi-grid">
  <div class="kpi-box"><div class="val">${s.totalAnalyzedPosts}</div><div class="lbl">Analyzed</div></div>
  <div class="kpi-box"><div class="val">${s.totalBiasFlaggedPosts}</div><div class="lbl">Flagged</div></div>
  <div class="kpi-box"><div class="val">${s.totalDebiasedPosts}</div><div class="lbl">Debiased</div></div>
  <div class="kpi-box"><div class="val">${s.averageBiasDelta.toFixed(3)}</div><div class="lbl">Avg Bias Delta</div></div>
</div>` : ''}

<h2>Agent Performance</h2>
<table><thead><tr><th>Agent</th><th>Region</th><th>Analyses</th><th>Avg Score</th><th>Confidence</th><th>Bias Delta</th></tr></thead>
<tbody>${agentRows || '<tr><td colspan="6">No agent data available</td></tr>'}</tbody></table>

<h2>Survey Verdict Accuracy</h2>
<table><thead><tr><th>Region</th><th>Correct / Total</th><th>Accuracy</th></tr></thead>
<tbody>${verdictRows || '<tr><td colspan="3">No verdict data available</td></tr>'}</tbody></table>

<h2>Survey Completion Status</h2>
${sc ? `<div class="kpi-grid">
  <div class="kpi-box"><div class="val">${sc.totalSessions}</div><div class="lbl">Total Sessions</div></div>
  <div class="kpi-box"><div class="val">${sc.completedSessions}</div><div class="lbl">Completed</div></div>
  <div class="kpi-box"><div class="val">${sc.inProgressSessions}</div><div class="lbl">In Progress</div></div>
  <div class="kpi-box"><div class="val">${((sc.completionRate ?? 0) * 100).toFixed(1)}%</div><div class="lbl">Completion Rate</div></div>
  <div class="kpi-box"><div class="val">${((sc.avgAccuracy ?? 0) * 100).toFixed(1)}%</div><div class="lbl">Avg Accuracy</div></div>
  <div class="kpi-box"><div class="val">${sc.avgItemsPerSession}</div><div class="lbl">Avg Items/Session</div></div>
</div>
<h3>By Mode</h3>
<table><thead><tr><th>Mode</th><th>Sessions</th><th>Avg Accuracy</th></tr></thead>
<tbody>${modeRows || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
<h3>By Difficulty</h3>
<table><thead><tr><th>Difficulty</th><th>Correct / Total</th><th>Accuracy</th></tr></thead>
<tbody>${diffRows || '<tr><td colspan="3">—</td></tr>'}</tbody></table>` : '<p>Survey data unavailable.</p>'}

${categoryRows ? `<h2>Accuracy by Category</h2>
<table><thead><tr><th>Category</th><th>Correct / Total</th><th>Accuracy</th></tr></thead>
<tbody>${categoryRows}</tbody></table>` : ''}

<h2>7-Day Bias Trends</h2>
<table><thead><tr><th>Date</th><th>Analyzed</th><th>Flagged</th><th>Avg Bias Delta</th><th>Avg Debiased</th></tr></thead>
<tbody>${trendRows || '<tr><td colspan="5">No trend data available</td></tr>'}</tbody></table>

<div class="footer">
  <p>TrustFeed Research Platform — ITIS 5360 · ${this.currentYear}</p>
  <p>This report was generated from live database and session data. All metrics are descriptive observability measures.</p>
</div>
</body></html>`;

    this.downloadFile(html, `trustfeed-report-${new Date().toISOString().slice(0, 10)}.html`, 'text/html');
  }

  private downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}

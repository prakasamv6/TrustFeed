import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe, PercentPipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { PostService } from '../../services/post.service';
import { AnalysisService } from '../../services/analysis.service';
import { DashboardSummary, DashboardAgentStats, DashboardTrends, AgentStat } from '../../models/dashboard.model';
import { getScoreColor, getScoreLabel } from '../../utils/score-utils';

@Component({
  selector: 'app-bias-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, PercentPipe],
  template: `
    <div class="dashboard-page">
      <div class="disclaimer-banner">
        ⚠️ BIAS SIMULATOR - NOT A REAL PROVENANCE JUDGE
      </div>

      <div class="dashboard-container">
        <header class="dashboard-header">
          <h1>📊 Bias Analysis Dashboard</h1>
          <p class="subtitle">Regional bias simulation analytics and debiasing results</p>
          <div class="header-actions">
            <button class="export-btn" (click)="exportJSON()">📄 Export JSON</button>
            <button class="export-btn" (click)="exportCSV()">📊 Export CSV</button>
          </div>
        </header>

        <!-- KPI Cards -->
        <section class="kpi-section" *ngIf="summary()">
          <div class="kpi-card">
            <span class="kpi-icon">📋</span>
            <div class="kpi-data">
              <span class="kpi-value">{{ summary()!.totalAnalyzedPosts }}</span>
              <span class="kpi-label">Total Analyzed</span>
            </div>
          </div>
          <div class="kpi-card flagged">
            <span class="kpi-icon">🚩</span>
            <div class="kpi-data">
              <span class="kpi-value">{{ summary()!.totalBiasFlaggedPosts }}</span>
              <span class="kpi-label">Bias Flagged</span>
            </div>
          </div>
          <div class="kpi-card safe">
            <span class="kpi-icon">✅</span>
            <div class="kpi-data">
              <span class="kpi-value">{{ summary()!.totalDebiasedPosts }}</span>
              <span class="kpi-label">Debiased</span>
            </div>
          </div>
          <div class="kpi-card delta">
            <span class="kpi-icon">📐</span>
            <div class="kpi-data">
              <span class="kpi-value">{{ summary()!.averageBiasDelta | number:'1.3-3' }}</span>
              <span class="kpi-label">Avg Bias Delta</span>
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-icon">📏</span>
            <div class="kpi-data">
              <span class="kpi-value">{{ summary()!.averageDisagreementRate | number:'1.3-3' }}</span>
              <span class="kpi-label">Avg Disagreement</span>
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-icon">🌍</span>
            <div class="kpi-data">
              <span class="kpi-value">{{ summary()!.averageRegionDominance | number:'1.3-3' }}</span>
              <span class="kpi-label">Avg Region Dominance</span>
            </div>
          </div>
        </section>

        <!-- Modality Breakdown -->
        <section class="section-row" *ngIf="summary()">
          <div class="panel modality-panel">
            <h3>🎭 Modality Breakdown</h3>
            <div class="modality-bars">
              <div class="mod-bar-row" *ngFor="let mod of getModalityEntries()">
                <span class="mod-label">{{ mod[0] | titlecase }}</span>
                <div class="mod-bar-track">
                  <div class="mod-bar-fill" [style.width.%]="getModalityPercent(mod[1])" [style.background]="getModalityColor(mod[0])"></div>
                </div>
                <span class="mod-count">{{ mod[1] }}</span>
              </div>
            </div>
          </div>

          <!-- Per-Agent Comparison -->
          <div class="panel agent-panel">
            <h3>🤖 Per-Agent Statistics</h3>
            <div class="agent-table-wrap">
              <table class="agent-table" *ngIf="agentStats()">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Region</th>
                    <th>Avg Score</th>
                    <th>Favoritism %</th>
                    <th>Avg Δ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let agent of agentStats()!.agents" [class.baseline]="agent.region === 'None'">
                    <td class="agent-name">{{ agent.agentName }}</td>
                    <td>{{ agent.region }}</td>
                    <td>{{ agent.averageScore | number:'1.2-2' }}</td>
                    <td>
                      <span class="fav-badge" [style.background]="getFavColor(agent.favoritismRate)">
                        {{ agent.favoritismRate | percent:'1.0-0' }}
                      </span>
                    </td>
                    <td>{{ agent.averageBiasDelta | number:'1.3-3' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Raw vs Debiased Chart (text-based bar chart) -->
        <section class="panel chart-panel" *ngIf="agentStats()">
          <h3>📊 Raw Biased vs Debiased Score Comparison</h3>
          <div class="bar-chart">
            <div class="bar-row" *ngFor="let agent of agentStats()!.agents">
              <span class="bar-label">{{ agent.agentName.replace('BiasAgent','').replace('NonBiasBaseline','Baseline') }}</span>
              <div class="bar-track">
                <div class="bar-fill raw" [style.width.%]="agent.averageScore * 100" title="Raw: {{ agent.averageScore | number:'1.2-2' }}"></div>
                <div class="bar-fill debiased" [style.width.%]="(agent.averageScore - agent.averageBiasDelta) * 100" title="Debiased: {{ (agent.averageScore - agent.averageBiasDelta) | number:'1.2-2' }}"></div>
              </div>
            </div>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot raw"></span> Raw Biased</span>
              <span class="legend-item"><span class="legend-dot debiased"></span> Debiased</span>
            </div>
          </div>
        </section>

        <!-- Trend Section -->
        <section class="panel chart-panel" *ngIf="trends()">
          <h3>📈 7-Day Trends</h3>
          <div class="trend-grid">
            <div class="trend-row header-row">
              <span>Date</span>
              <span>Analyzed</span>
              <span>Flagged</span>
              <span>Avg Δ</span>
              <span>Avg Debiased</span>
            </div>
            <div class="trend-row" *ngFor="let pt of trends()!.points">
              <span>{{ pt.date }}</span>
              <span>{{ pt.totalAnalyzed }}</span>
              <span class="flagged-count">{{ pt.biasFlaggedCount }}</span>
              <span>{{ pt.averageBiasDelta | number:'1.3-3' }}</span>
              <span>{{ pt.averageDebiasedScore | number:'1.3-3' }}</span>
            </div>
          </div>
        </section>

        <!-- Bias-Flagged Posts Table -->
        <section class="panel">
          <h3>🚩 Bias-Flagged Posts</h3>
          <div class="flagged-table-wrap">
            <table class="agent-table">
              <thead>
                <tr>
                  <th>Post ID</th>
                  <th>Author</th>
                  <th>Type</th>
                  <th>Raw</th>
                  <th>Baseline</th>
                  <th>Debiased</th>
                  <th>Δ</th>
                  <th>Dominant Agent</th>
                  <th>Region</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let post of getFlaggedPosts()">
                  <td>{{ post.id }}</td>
                  <td>{{ post.author.name }}</td>
                  <td>{{ post.contentType }}</td>
                  <td>{{ post.biasResult!.rawBiasedScore | number:'1.3-3' }}</td>
                  <td>{{ post.biasResult!.baselineNonbiasedScore | number:'1.3-3' }}</td>
                  <td>{{ post.biasResult!.debiasedAdjustedScore | number:'1.3-3' }}</td>
                  <td class="delta-cell">{{ post.biasResult!.biasDelta | number:'1.3-3' }}</td>
                  <td>{{ post.biasResult!.dominantBiasedAgent }}</td>
                  <td>{{ post.biasResult!.favoredRegion }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="getFlaggedPosts().length === 0" class="empty-msg">No bias-flagged posts yet.</div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page { min-height: 100vh; }
    .disclaimer-banner {
      background: linear-gradient(135deg, #ff6b6b, #ff8e53);
      color: white; text-align: center; padding: 0.5rem; font-weight: 700;
      font-size: 0.85rem; letter-spacing: 1px;
    }
    .dashboard-container {
      max-width: 1400px; margin: 0 auto; padding: 2rem;
    }
    .dashboard-header {
      margin-bottom: 2rem;
      h1 { margin: 0 0 0.5rem; color: #e6e6e6; font-size: 1.75rem; }
      .subtitle { color: #8892b0; font-size: 0.9rem; margin: 0; }
    }
    .header-actions {
      display: flex; gap: 0.5rem; margin-top: 1rem;
    }
    .export-btn {
      background: rgba(0, 217, 255, 0.1); border: 1px solid rgba(0, 217, 255, 0.3);
      color: #00d9ff; padding: 0.5rem 1.25rem; border-radius: 20px;
      cursor: pointer; font-size: 0.85rem; transition: all 0.3s ease;
      &:hover { background: rgba(0, 217, 255, 0.2); transform: translateY(-1px); }
    }
    .kpi-section {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem; margin-bottom: 2rem;
    }
    .kpi-card {
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 16px; padding: 1.25rem; display: flex; align-items: center;
      gap: 1rem; border: 1px solid rgba(255,255,255,0.05);
      .kpi-icon { font-size: 2rem; }
      .kpi-data { display: flex; flex-direction: column; }
      .kpi-value { font-size: 1.5rem; font-weight: 700; color: #00d9ff; }
      .kpi-label { font-size: 0.75rem; color: #8892b0; }
      &.flagged .kpi-value { color: #e91e63; }
      &.safe .kpi-value { color: #4caf50; }
      &.delta .kpi-value { color: #ff9800; }
    }
    .section-row {
      display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-bottom: 1.5rem;
    }
    .panel {
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 16px; padding: 1.5rem;
      border: 1px solid rgba(255,255,255,0.05); margin-bottom: 1.5rem;
      h3 { margin: 0 0 1.25rem; color: #e6e6e6; font-size: 1.1rem; }
    }
    .modality-bars { display: flex; flex-direction: column; gap: 0.75rem; }
    .mod-bar-row { display: flex; align-items: center; gap: 0.75rem; }
    .mod-label { width: 60px; font-size: 0.8rem; color: #ccd6f6; }
    .mod-bar-track {
      flex: 1; height: 24px; background: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;
    }
    .mod-bar-fill { height: 100%; border-radius: 12px; transition: width 0.5s ease; }
    .mod-count { font-size: 0.85rem; color: #8892b0; width: 30px; text-align: right; }
    .agent-table-wrap { overflow-x: auto; }
    .agent-table {
      width: 100%; border-collapse: collapse; font-size: 0.8rem;
      th { padding: 0.75rem; text-align: left; color: #8892b0; border-bottom: 1px solid rgba(255,255,255,0.1);
        font-weight: 500; }
      td { padding: 0.75rem; color: #ccd6f6; border-bottom: 1px solid rgba(255,255,255,0.03); }
      .agent-name { font-weight: 600; color: #e6e6e6; }
      tr.baseline td { background: rgba(0, 217, 255, 0.05); }
    }
    .fav-badge {
      padding: 0.2rem 0.6rem; border-radius: 10px; font-size: 0.75rem;
      font-weight: 600; color: white;
    }
    .delta-cell { color: #ff9800; font-weight: 600; }
    .bar-chart { margin-top: 0.5rem; }
    .bar-row {
      display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;
    }
    .bar-label { width: 90px; font-size: 0.75rem; color: #ccd6f6; text-align: right; }
    .bar-track {
      flex: 1; height: 20px; background: rgba(255,255,255,0.05); border-radius: 10px;
      overflow: hidden; position: relative;
    }
    .bar-fill {
      position: absolute; top: 0; left: 0; height: 100%;
      border-radius: 10px; transition: width 0.5s ease;
      &.raw { background: rgba(233, 30, 99, 0.6); z-index: 1; }
      &.debiased { background: rgba(0, 217, 255, 0.6); z-index: 2; }
    }
    .chart-legend {
      display: flex; gap: 1.5rem; margin-top: 0.75rem; justify-content: center;
    }
    .legend-item {
      display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #8892b0;
    }
    .legend-dot {
      width: 12px; height: 12px; border-radius: 3px;
      &.raw { background: rgba(233, 30, 99, 0.8); }
      &.debiased { background: rgba(0, 217, 255, 0.8); }
    }
    .trend-grid { font-size: 0.8rem; }
    .trend-row {
      display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr;
      padding: 0.6rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.03);
      color: #ccd6f6;
      &.header-row { color: #8892b0; font-weight: 500; border-bottom-color: rgba(255,255,255,0.1); }
    }
    .flagged-count { color: #e91e63; font-weight: 600; }
    .flagged-table-wrap { overflow-x: auto; }
    .empty-msg { color: #8892b0; font-size: 0.85rem; text-align: center; padding: 2rem; }
    @media (max-width: 900px) {
      .section-row { grid-template-columns: 1fr; }
      .kpi-section { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class BiasDashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private postService = inject(PostService);

  summary = signal<DashboardSummary | null>(null);
  agentStats = signal<DashboardAgentStats | null>(null);
  trends = signal<DashboardTrends | null>(null);

  ngOnInit(): void {
    this.dashboardService.getSummary().subscribe(s => this.summary.set(s));
    this.dashboardService.getAgentStats().subscribe(s => this.agentStats.set(s));
    this.dashboardService.getTrends().subscribe(t => this.trends.set(t));
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
      case 'text': return 'linear-gradient(135deg, #00d9ff, #00b8d9)';
      case 'image': return 'linear-gradient(135deg, #00ff88, #00d975)';
      case 'video': return 'linear-gradient(135deg, #ff9800, #ff6d00)';
      default: return '#8892b0';
    }
  }

  getFavColor(rate: number): string {
    if (rate >= 0.5) return 'rgba(233, 30, 99, 0.7)';
    if (rate >= 0.3) return 'rgba(255, 152, 0, 0.7)';
    return 'rgba(76, 175, 80, 0.7)';
  }

  getFlaggedPosts() {
    return this.postService.getAllPosts().filter(p => p.biasResult?.favoritismFlag);
  }

  exportJSON(): void {
    const data = {
      summary: this.summary(),
      agentStats: this.agentStats(),
      trends: this.trends(),
      flaggedPosts: this.getFlaggedPosts().map(p => ({
        id: p.id, author: p.author.name, contentType: p.contentType,
        ...p.biasResult
      }))
    };
    this.downloadFile(JSON.stringify(data, null, 2), 'bias-report.json', 'application/json');
  }

  exportCSV(): void {
    const posts = this.getFlaggedPosts();
    const header = 'PostID,Author,ContentType,RawBiased,Baseline,Debiased,BiasDelta,DominantAgent,FavoredRegion\n';
    const rows = posts.map(p => {
      const b = p.biasResult!;
      return `${p.id},${p.author.name},${p.contentType},${b.rawBiasedScore},${b.baselineNonbiasedScore},${b.debiasedAdjustedScore},${b.biasDelta},${b.dominantBiasedAgent},${b.favoredRegion}`;
    }).join('\n');
    this.downloadFile(header + rows, 'bias-report.csv', 'text/csv');
  }

  private downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}

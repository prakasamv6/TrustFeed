import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe, UpperCasePipe } from '@angular/common';
import { SurveyService } from '../../services/survey.service';
import { Continent } from '../../models/survey.model';

@Component({
  selector: 'app-survey-results',
  standalone: true,
  imports: [CommonModule, DecimalPipe, UpperCasePipe],
  template: `
    <div class="results-container" *ngIf="surveyService.results() as r">
      <!-- Results Header -->
      <div class="results-hero">
        <span class="hero-icon">📊</span>
        <h1>Survey Results Dashboard</h1>
        <p class="hero-sub">Human-in-the-Loop AI Research — Data Authenticity Assessment</p>
        <div class="mode-badge" [class.collab]="r.collabMode">
          {{ r.collabMode ? '🤝 Human-AI Collab Mode' : '👤 Solo Mode' }}
        </div>
      </div>

      <!-- Ground Truth Summary -->
      <div class="section truth-section">
        <h2>🔍 Content Ground Truth</h2>
        <div class="truth-grid">
          <div class="truth-card">
            <span class="tc-value">{{ r.totalItems }}</span>
            <span class="tc-label">Total Items</span>
          </div>
          <div class="truth-card ai">
            <span class="tc-value">{{ r.actualAiCount }}</span>
            <span class="tc-label">Actually AI</span>
          </div>
          <div class="truth-card human">
            <span class="tc-value">{{ r.actualHumanCount }}</span>
            <span class="tc-label">Actually Human</span>
          </div>
        </div>
      </div>

      <!-- Human vs All Agents Summary -->
      <div class="section comparison-section">
        <h2>🏆 Accuracy Comparison — Human vs. AI Agents</h2>
        <div class="comparison-chart">
          <!-- Human row -->
          <div class="comp-row human-row">
            <div class="comp-label">
              <span class="comp-icon">👤</span>
              <span class="comp-name">You (Human)</span>
            </div>
            <div class="comp-bar-wrap">
              <div class="comp-bar human-bar" [style.width.%]="r.humanAccuracy * 100"></div>
            </div>
            <span class="comp-pct">{{ r.humanAccuracy * 100 | number:'1.0-0' }}%</span>
            <span class="comp-detail">{{ r.humanCorrect }}/{{ r.totalItems }}</span>
          </div>
          <!-- Agent rows -->
          <div class="comp-row" *ngFor="let a of r.agentResults">
            <div class="comp-label">
              <span class="comp-icon">{{ getRegionFlag(a.region) }}</span>
              <span class="comp-name">{{ a.region }}</span>
            </div>
            <div class="comp-bar-wrap">
              <div class="comp-bar agent-bar" [style.width.%]="a.accuracy * 100"
                [class.better]="a.accuracy > r.humanAccuracy"
                [class.worse]="a.accuracy < r.humanAccuracy"></div>
            </div>
            <span class="comp-pct">{{ a.accuracy * 100 | number:'1.0-0' }}%</span>
            <span class="comp-detail">{{ a.correct }}/{{ r.totalItems }}</span>
          </div>
        </div>
      </div>

      <!-- Human Output: How many AI vs Human -->
      <div class="section human-output-section">
        <h2>👤 Human Output — Your Classifications</h2>
        <div class="output-grid">
          <div class="output-card">
            <div class="output-donut">
              <svg viewBox="0 0 36 36" class="donut-svg">
                <path class="donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="donut-ai" [attr.stroke-dasharray]="getHumanAiPercent(r) + ', 100'"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div class="donut-center">
                <span class="donut-val">{{ r.humanAiCount }}</span>
                <span class="donut-label">Said AI</span>
              </div>
            </div>
          </div>
          <div class="output-card">
            <div class="output-donut">
              <svg viewBox="0 0 36 36" class="donut-svg">
                <path class="donut-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="donut-human" [attr.stroke-dasharray]="getHumanHumanPercent(r) + ', 100'"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div class="donut-center">
                <span class="donut-val">{{ r.humanHumanCount }}</span>
                <span class="donut-label">Said Human</span>
              </div>
            </div>
          </div>
          <div class="output-stats">
            <div class="os-row">
              <span>Accuracy</span>
              <span class="os-val" [class.good]="r.humanAccuracy >= 0.7" [class.bad]="r.humanAccuracy < 0.5">
                {{ r.humanAccuracy * 100 | number:'1.1-1' }}%
              </span>
            </div>
            <div class="os-row">
              <span>Correct</span>
              <span class="os-val">{{ r.humanCorrect }} / {{ r.totalItems }}</span>
            </div>
            <div class="os-row">
              <span>AI Prediction Bias</span>
              <span class="os-val">{{ r.humanAiCount > r.actualAiCount ? 'Over-flags AI' : r.humanAiCount < r.actualAiCount ? 'Under-flags AI' : 'Balanced' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent Output: How many AI vs Human per agent -->
      <div class="section agent-output-section">
        <h2>🌍 Agent Outputs — AI vs Human Classifications</h2>
        <div class="agent-output-grid">
          <div class="agent-output-card" *ngFor="let a of r.agentResults">
            <div class="aoc-header">
              <span class="aoc-flag">{{ getRegionFlag(a.region) }}</span>
              <span class="aoc-name">{{ a.region }} Agent</span>
              <span class="aoc-accuracy" [class.good]="a.accuracy >= 0.7" [class.bad]="a.accuracy < 0.5">
                {{ a.accuracy * 100 | number:'1.0-0' }}%
              </span>
            </div>
            <div class="aoc-bar">
              <div class="aoc-ai-fill" [style.width.%]="(a.aiCount / r.totalItems) * 100">
                🤖 {{ a.aiCount }}
              </div>
              <div class="aoc-human-fill" [style.width.%]="(a.humanCount / r.totalItems) * 100">
                👤 {{ a.humanCount }}
              </div>
            </div>
            <div class="aoc-details">
              <span>Correct: {{ a.correct }}/{{ r.totalItems }}</span>
              <span>Avg Confidence: {{ a.avgConfidence * 100 | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Agreement Matrix -->
      <div class="section agreement-section">
        <h2>🤝 Human-Agent Agreement Matrix</h2>
        <p class="section-desc">How often your verdict matched each agent's verdict</p>
        <div class="agreement-grid">
          <div class="agreement-card" *ngFor="let ag of r.agreementMatrix">
            <span class="ag-flag">{{ getRegionFlag(ag.region) }}</span>
            <span class="ag-region">{{ ag.region }}</span>
            <div class="ag-bar-wrap">
              <div class="ag-bar" [style.width.%]="ag.agreementRate * 100"
                [class.high]="ag.agreementRate >= 0.7"
                [class.mid]="ag.agreementRate >= 0.4 && ag.agreementRate < 0.7"
                [class.low]="ag.agreementRate < 0.4"></div>
            </div>
            <span class="ag-rate">{{ ag.agreementRate * 100 | number:'1.0-0' }}%</span>
          </div>
        </div>
      </div>

      <!-- Per-Item Breakdown -->
      <div class="section breakdown-section">
        <h2>📝 Per-Item Breakdown</h2>
        <div class="breakdown-table">
          <div class="bt-header">
            <span class="bt-col bt-num">#</span>
            <span class="bt-col bt-title">Title</span>
            <span class="bt-col bt-truth">Truth</span>
            <span class="bt-col bt-human">Human</span>
            <span class="bt-col bt-agents" *ngFor="let c of continents">{{ getRegionFlag(c) }}</span>
          </div>
          <div class="bt-row" *ngFor="let item of surveyService.session()!.items; let i = index">
            <span class="bt-col bt-num">{{ i + 1 }}</span>
            <span class="bt-col bt-title" [title]="item.title">{{ item.title }}</span>
            <span class="bt-col bt-truth" [class]="'label-' + item.groundTruth">{{ item.groundTruth | uppercase }}</span>
            <span class="bt-col bt-human"
              [class.cell-correct]="item.humanVerdict === item.groundTruth"
              [class.cell-wrong]="item.humanVerdict !== item.groundTruth">
              {{ item.humanVerdict! | uppercase }}
            </span>
            <span class="bt-col bt-agents" *ngFor="let c of continents"
              [class.cell-correct]="getAgentVerdict(item, c) === item.groundTruth"
              [class.cell-wrong]="getAgentVerdict(item, c) !== item.groundTruth">
              {{ getAgentVerdict(item, c) | uppercase }}
            </span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="results-actions">
        <button class="action-btn retry-btn" (click)="retake()">
          <span>🔄</span> Take New Survey
        </button>
        <button class="action-btn collab-btn" (click)="retakeCollab()">
          <span>🤝</span> Try {{ r.collabMode ? 'Solo' : 'Collab' }} Mode
        </button>
      </div>
    </div>
  `,
  styles: [`
    .results-container {
      max-width: 1000px; margin: 0 auto; padding: 2rem;
      display: flex; flex-direction: column; gap: 2rem;
    }

    /* Hero */
    .results-hero {
      text-align: center; padding: 2rem;
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);
      .hero-icon { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
      h1 { margin: 0 0 0.4rem; color: #e6e6e6; font-size: 1.75rem; }
      .hero-sub { color: #8892b0; font-size: 0.95rem; margin: 0 0 1rem; }
    }
    .mode-badge {
      display: inline-block; padding: 0.4rem 1.25rem; border-radius: 20px;
      font-size: 0.85rem; font-weight: 600;
      background: rgba(0,217,255,0.1); color: #00d9ff;
      border: 1px solid rgba(0,217,255,0.2);
      &.collab { background: rgba(156,39,176,0.1); color: #ce93d8; border-color: rgba(156,39,176,0.2); }
    }

    /* Sections */
    .section {
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 16px; padding: 1.75rem; border: 1px solid rgba(255,255,255,0.05);
      h2 { margin: 0 0 1.25rem; color: #e6e6e6; font-size: 1.15rem; }
    }
    .section-desc { color: #8892b0; font-size: 0.82rem; margin: -0.75rem 0 1rem; }

    /* Truth */
    .truth-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .truth-card {
      text-align: center; padding: 1.25rem; border-radius: 12px;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
      .tc-value { display: block; font-size: 2rem; font-weight: 700; color: #00d9ff; }
      .tc-label { font-size: 0.75rem; color: #8892b0; }
      &.ai .tc-value { color: #e91e63; }
      &.human .tc-value { color: #4caf50; }
    }

    /* Comparison Chart */
    .comparison-chart { display: flex; flex-direction: column; gap: 0.75rem; }
    .comp-row {
      display: grid; grid-template-columns: 140px 1fr 55px 55px; gap: 0.75rem; align-items: center;
      &.human-row { padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.25rem; }
    }
    .comp-label { display: flex; align-items: center; gap: 0.5rem; }
    .comp-icon { font-size: 1.1rem; }
    .comp-name { font-size: 0.82rem; color: #ccd6f6; font-weight: 500; }
    .comp-bar-wrap { height: 20px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
    .comp-bar {
      height: 100%; border-radius: 4px; transition: width 0.6s;
      &.human-bar { background: linear-gradient(90deg, #00d9ff, #00ff88); }
      &.agent-bar { background: rgba(156,39,176,0.5); }
      &.agent-bar.better { background: linear-gradient(90deg, #4caf50, #8bc34a); }
      &.agent-bar.worse { background: rgba(244,67,54,0.4); }
    }
    .comp-pct { font-size: 0.85rem; color: #e6e6e6; font-weight: 700; text-align: right; }
    .comp-detail { font-size: 0.7rem; color: #8892b0; text-align: right; }

    /* Human Output */
    .output-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; align-items: center; }
    .output-card { display: flex; justify-content: center; }
    .output-donut { position: relative; width: 120px; height: 120px; }
    .donut-svg { width: 100%; height: 100%; }
    .donut-bg, .donut-ai, .donut-human {
      fill: none; stroke-width: 3; stroke-linecap: round;
    }
    .donut-bg { stroke: rgba(255,255,255,0.06); }
    .donut-ai { stroke: #e91e63; stroke-dashoffset: 25; }
    .donut-human { stroke: #4caf50; stroke-dashoffset: 25; }
    .donut-center {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      display: flex; flex-direction: column; align-items: center;
      .donut-val { font-size: 1.5rem; font-weight: 700; color: #e6e6e6; }
      .donut-label { font-size: 0.65rem; color: #8892b0; }
    }
    .output-stats { display: flex; flex-direction: column; gap: 0.6rem; }
    .os-row {
      display: flex; justify-content: space-between; font-size: 0.82rem; color: #8892b0;
      padding: 0.4rem 0; border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .os-val {
      font-weight: 600; color: #ccd6f6;
      &.good { color: #4caf50; }
      &.bad { color: #f44336; }
    }

    /* Agent Output */
    .agent-output-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;
    }
    .agent-output-card {
      padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .aoc-header {
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;
      .aoc-flag { font-size: 1.2rem; }
      .aoc-name { font-size: 0.85rem; color: #ccd6f6; font-weight: 600; flex: 1; }
      .aoc-accuracy {
        font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 8px;
        &.good { background: rgba(76,175,80,0.15); color: #4caf50; }
        &.bad { background: rgba(244,67,54,0.15); color: #f44336; }
      }
    }
    .aoc-bar {
      display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin-bottom: 0.5rem;
    }
    .aoc-ai-fill {
      background: linear-gradient(90deg, rgba(233,30,99,0.4), rgba(233,30,99,0.6));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; color: white; font-weight: 600; min-width: 40px;
    }
    .aoc-human-fill {
      background: linear-gradient(90deg, rgba(76,175,80,0.4), rgba(76,175,80,0.6));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; color: white; font-weight: 600; min-width: 40px;
    }
    .aoc-details {
      display: flex; justify-content: space-between; font-size: 0.7rem; color: #8892b0;
    }

    /* Agreement */
    .agreement-grid { display: flex; flex-direction: column; gap: 0.6rem; }
    .agreement-card {
      display: grid; grid-template-columns: 30px 90px 1fr 50px; gap: 0.75rem; align-items: center;
    }
    .ag-flag { font-size: 1.1rem; text-align: center; }
    .ag-region { font-size: 0.82rem; color: #ccd6f6; font-weight: 500; }
    .ag-bar-wrap { height: 14px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
    .ag-bar {
      height: 100%; border-radius: 4px; transition: width 0.5s;
      &.high { background: linear-gradient(90deg, #4caf50, #8bc34a); }
      &.mid { background: linear-gradient(90deg, #ff9800, #ffb74d); }
      &.low { background: linear-gradient(90deg, #f44336, #e57373); }
    }
    .ag-rate { font-size: 0.8rem; color: #e6e6e6; font-weight: 600; text-align: right; }

    /* Breakdown Table */
    .breakdown-table {
      overflow-x: auto;
    }
    .bt-header, .bt-row {
      display: grid;
      grid-template-columns: 35px 1fr 55px 55px repeat(5, 45px);
      gap: 0.4rem; align-items: center; padding: 0.5rem 0;
    }
    .bt-header {
      border-bottom: 1px solid rgba(255,255,255,0.1);
      .bt-col { font-size: 0.7rem; color: #8892b0; font-weight: 600; }
    }
    .bt-row {
      border-bottom: 1px solid rgba(255,255,255,0.03);
      &:hover { background: rgba(255,255,255,0.02); }
    }
    .bt-col { font-size: 0.72rem; color: #ccd6f6; }
    .bt-num { text-align: center; color: #8892b0; }
    .bt-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-ai { color: #e91e63; font-weight: 600; }
    .label-human { color: #4caf50; font-weight: 600; }
    .cell-correct { color: #4caf50; font-weight: 600; }
    .cell-wrong { color: #f44336; font-weight: 600; }
    .bt-agents { text-align: center; font-size: 0.6rem; }

    /* Actions */
    .results-actions {
      display: flex; gap: 1rem; justify-content: center;
    }
    .action-btn {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 2rem;
      border-radius: 12px; cursor: pointer; font-size: 0.95rem; font-weight: 600;
      border: none; transition: all 0.3s;
      &:hover { transform: translateY(-2px); }
    }
    .retry-btn {
      background: linear-gradient(135deg, #00d9ff, #00ff88); color: #0a0a0f;
      &:hover { box-shadow: 0 8px 25px rgba(0,217,255,0.3); }
    }
    .collab-btn {
      background: linear-gradient(135deg, #9c27b0, #e91e63); color: white;
      &:hover { box-shadow: 0 8px 25px rgba(156,39,176,0.3); }
    }

    @media (max-width: 700px) {
      .output-grid { grid-template-columns: 1fr; }
      .agent-output-grid { grid-template-columns: 1fr; }
      .comp-row { grid-template-columns: 100px 1fr 45px 45px; }
      .truth-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class SurveyResultsComponent {
  surveyService = inject(SurveyService);

  continents: Continent[] = ['Africa', 'Asia', 'Europe', 'Americas', 'Oceania'];

  private regionFlags: Record<string, string> = {
    'Africa': '🌍', 'Asia': '🌏', 'Europe': '🇪🇺', 'Americas': '🌎', 'Oceania': '🏝️',
  };

  getRegionFlag(region: string): string {
    return this.regionFlags[region] ?? '🌐';
  }

  getHumanAiPercent(r: { humanAiCount: number; totalItems: number }): number {
    return Math.round((r.humanAiCount / r.totalItems) * 100);
  }

  getHumanHumanPercent(r: { humanHumanCount: number; totalItems: number }): number {
    return Math.round((r.humanHumanCount / r.totalItems) * 100);
  }

  getAgentVerdict(item: { agentVerdicts: { region: string; verdict: string }[] }, region: Continent): string {
    return item.agentVerdicts.find(v => v.region === region)?.verdict ?? '?';
  }

  retake(): void {
    this.surveyService.startSession(10, false);
  }

  retakeCollab(): void {
    const currentCollab = this.surveyService.results()?.collabMode ?? false;
    this.surveyService.startSession(10, !currentCollab);
  }
}

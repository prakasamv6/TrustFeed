import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, UpperCasePipe, DatePipe } from '@angular/common';
import { SurveyService } from '../../services/survey.service';
import { ApiService } from '../../services/api.service';
import { Continent, SessionSummary } from '../../models/survey.model';

@Component({
  selector: 'app-survey-results',
  standalone: true,
  imports: [DecimalPipe, UpperCasePipe, DatePipe],
  template: `
    @let r = surveyService.results();
    @if (r) {
    <div class="results-container">
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
          @for (a of r.agentResults; track a.region) {
          <div class="comp-row">
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
          }
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
          @for (a of r.agentResults; track a.region) {
          <div class="agent-output-card">
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
          }
        </div>
      </div>

      <!-- Agreement Matrix -->
      <div class="section agreement-section">
        <h2>🤝 Human-Agent Agreement Matrix</h2>
        <p class="section-desc">How often your verdict matched each agent's verdict</p>
        <div class="agreement-grid">
          @for (ag of r.agreementMatrix; track ag.region) {
          <div class="agreement-card">
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
          }
        </div>
      </div>

      <!-- AI Indicator Effectiveness Dashboard -->
      <div class="section ai-indicator-section">
        <h2>🧠 AI Indicator Effectiveness</h2>
        <p class="section-desc">How AI agent indicators helped users identify content authenticity</p>
        <div class="indicator-grid">
          <div class="indicator-card">
            <span class="ind-icon">🎯</span>
            <span class="ind-label">Human Accuracy</span>
            <span class="ind-value" [class.good]="r.humanAccuracy >= 0.7" [class.bad]="r.humanAccuracy < 0.5">
              {{ r.humanAccuracy * 100 | number:'1.1-1' }}%
            </span>
          </div>
          <div class="indicator-card">
            <span class="ind-icon">🤖</span>
            <span class="ind-label">Best Agent Accuracy</span>
            <span class="ind-value good">
              {{ getBestAgentAccuracy(r) * 100 | number:'1.1-1' }}%
            </span>
          </div>
          <div class="indicator-card">
            <span class="ind-icon">📈</span>
            <span class="ind-label">Avg Agent Accuracy</span>
            <span class="ind-value">
              {{ getAvgAgentAccuracy(r) * 100 | number:'1.1-1' }}%
            </span>
          </div>
          <div class="indicator-card">
            <span class="ind-icon">{{ r.humanAccuracy >= getAvgAgentAccuracy(r) ? '🏆' : '📉' }}</span>
            <span class="ind-label">Human vs AI Gap</span>
            <span class="ind-value" [class.good]="r.humanAccuracy >= getAvgAgentAccuracy(r)">
              {{ ((r.humanAccuracy - getAvgAgentAccuracy(r)) * 100) | number:'1.1-1' }}%
            </span>
          </div>
        </div>
        <div class="indicator-summary">
          <p>
            @if (r.collabMode) {
            In <strong>Human-AI Collaboration</strong> mode, AI indicators
            {{ r.humanAccuracy >= getAvgAgentAccuracy(r) ? 'enhanced' : 'did not improve' }}
            your detection accuracy compared to the average agent performance.
            The best-performing agent achieved {{ getBestAgentAccuracy(r) * 100 | number:'1.0-0' }}% accuracy.
            } @else {
            In <strong>Solo</strong> mode without AI hints, you achieved
            {{ r.humanAccuracy * 100 | number:'1.0-0' }}% accuracy.
            Try <strong>Human-AI Collab</strong> mode to see how AI indicators affect your decisions.
            }
          </p>
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
            @for (c of continents; track c) {
            <span class="bt-col bt-agents">{{ getRegionFlag(c) }}</span>
            }
          </div>
          @let session = surveyService.session();
          @if (session) {
          @for (item of session.items; track $index) {
          <div class="bt-row">
            <span class="bt-col bt-num">{{ $index + 1 }}</span>
            <span class="bt-col bt-title" [title]="item.title">{{ item.title }}</span>
            <span class="bt-col bt-truth" [class]="'label-' + item.groundTruth">{{ item.groundTruth | uppercase }}</span>
            <span class="bt-col bt-human"
              [class.cell-correct]="item.humanVerdict === item.groundTruth"
              [class.cell-wrong]="item.humanVerdict !== item.groundTruth">
              {{ item.humanVerdict | uppercase }}
            </span>
            @for (c of continents; track c) {
            <span class="bt-col bt-agents"
              [class.cell-correct]="getAgentVerdict(item, c) === item.groundTruth"
              [class.cell-wrong]="getAgentVerdict(item, c) !== item.groundTruth">
              {{ getAgentVerdict(item, c) | uppercase }}
            </span>
            }
          </div>
          }
          }
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

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- SESSION HISTORY & CROSS-SESSION PERFORMANCE DASHBOARD      -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      @if (pastSessions().length > 0) {

      <!-- Performance Persona -->
      <div class="section persona-section">
        <h2>🎭 Your Performance Persona</h2>
        <div class="persona-card">
          <span class="persona-icon">{{ getPersonaIcon() }}</span>
          <div class="persona-info">
            <h3 class="persona-title">{{ getPersonaTitle() }}</h3>
            <p class="persona-desc">{{ getPersonaDescription() }}</p>
          </div>
          <div class="persona-stats">
            <div class="ps-item">
              <span class="ps-val">{{ pastSessions().length }}</span>
              <span class="ps-label">Sessions</span>
            </div>
            <div class="ps-item">
              <span class="ps-val">{{ getOverallAccuracy() * 100 | number:'1.0-0' }}%</span>
              <span class="ps-label">Overall Accuracy</span>
            </div>
            <div class="ps-item">
              <span class="ps-val">{{ getTotalItems() }}</span>
              <span class="ps-label">Items Evaluated</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Session History Comparison -->
      <div class="section history-section">
        <h2>📜 Session History — All Surveys</h2>
        <p class="section-desc">Comparing your selections and accuracy across all completed sessions</p>
        <div class="history-table">
          <div class="ht-header">
            <span class="ht-col ht-num">#</span>
            <span class="ht-col ht-date">Date</span>
            <span class="ht-col ht-mode">Mode</span>
            <span class="ht-col ht-items">Items</span>
            <span class="ht-col ht-acc">Your Accuracy</span>
            <span class="ht-col ht-said-ai">Said AI</span>
            <span class="ht-col ht-said-hum">Said Human</span>
            <span class="ht-col ht-actual-ai">Actual AI</span>
            <span class="ht-col ht-best-agent">Best Agent</span>
          </div>
          @for (s of pastSessions(); track s.sessionId; let i = $index) {
          <div class="ht-row" [class.current-session]="s.sessionId === r.sessionId">
            <span class="ht-col ht-num">{{ i + 1 }}</span>
            <span class="ht-col ht-date">{{ s.completedAt | date:'MMM d, h:mm a' }}</span>
            <span class="ht-col ht-mode">
              <span class="mode-chip" [class.collab]="s.collabMode">{{ s.collabMode ? '🤝' : '👤' }}</span>
            </span>
            <span class="ht-col ht-items">{{ s.totalItems }}</span>
            <span class="ht-col ht-acc"
              [class.good]="s.humanAccuracy >= 0.7"
              [class.bad]="s.humanAccuracy < 0.5">
              {{ s.humanAccuracy * 100 | number:'1.0-0' }}%
            </span>
            <span class="ht-col ht-said-ai">{{ s.humanAiCount }}</span>
            <span class="ht-col ht-said-hum">{{ s.humanHumanCount }}</span>
            <span class="ht-col ht-actual-ai">{{ s.actualAiCount }}</span>
            <span class="ht-col ht-best-agent">
              {{ getBestAgentAccForSession(s) * 100 | number:'1.0-0' }}%
            </span>
          </div>
          }
        </div>
      </div>

      <!-- Selection Pattern Analysis -->
      <div class="section pattern-section">
        <h2>📊 Selection vs Ground Truth — Across All Sessions</h2>
        <p class="section-desc">How your selections compare to actual content labels over time</p>
        <div class="pattern-grid">
          <div class="pattern-card">
            <h4>Your AI Selections</h4>
            <span class="pat-big">{{ getTotalSaidAi() }}</span>
            <span class="pat-sub">out of {{ getTotalItems() }} items</span>
            <div class="pat-bar-wrap">
              <div class="pat-bar ai-bar" [style.width.%]="(getTotalSaidAi() / Math.max(getTotalItems(),1)) * 100"></div>
            </div>
          </div>
          <div class="pattern-card">
            <h4>Actual AI Content</h4>
            <span class="pat-big">{{ getTotalActualAi() }}</span>
            <span class="pat-sub">out of {{ getTotalItems() }} items</span>
            <div class="pat-bar-wrap">
              <div class="pat-bar truth-bar" [style.width.%]="(getTotalActualAi() / Math.max(getTotalItems(),1)) * 100"></div>
            </div>
          </div>
          <div class="pattern-card">
            <h4>Detection Bias</h4>
            <span class="pat-big" [class.over]="getTotalSaidAi() > getTotalActualAi()" [class.under]="getTotalSaidAi() < getTotalActualAi()">
              {{ getTotalSaidAi() > getTotalActualAi() ? 'Over-flags AI' : getTotalSaidAi() < getTotalActualAi() ? 'Under-flags AI' : 'Balanced' }}
            </span>
            <span class="pat-sub">
              Δ {{ Math.abs(getTotalSaidAi() - getTotalActualAi()) }} items
            </span>
          </div>
          <div class="pattern-card">
            <h4>Total Correct</h4>
            <span class="pat-big good">{{ getTotalCorrect() }}</span>
            <span class="pat-sub">{{ getOverallAccuracy() * 100 | number:'1.1-1' }}% accuracy</span>
          </div>
        </div>
      </div>

      <!-- AI Indicator Effectiveness — Solo vs Collab comparison -->
      @if (hasBothModes()) {
      <div class="section collab-compare-section">
        <h2>🧠 AI Indicator Impact — Solo vs Collab</h2>
        <p class="section-desc">How AI agent hints affected your detection accuracy across sessions</p>
        <div class="collab-compare-grid">
          <div class="cc-card solo">
            <span class="cc-icon">👤</span>
            <h4>Solo Mode</h4>
            <span class="cc-acc" [class.good]="getSoloAccuracy() >= 0.7">{{ getSoloAccuracy() * 100 | number:'1.0-0' }}%</span>
            <span class="cc-sessions">{{ getSoloCount() }} sessions</span>
          </div>
          <div class="cc-card vs">
            <span class="cc-vs-icon">⚡</span>
            <span class="cc-delta" [class.positive]="getCollabAccuracy() > getSoloAccuracy()" [class.negative]="getCollabAccuracy() < getSoloAccuracy()">
              {{ getCollabAccuracy() > getSoloAccuracy() ? '+' : '' }}{{ ((getCollabAccuracy() - getSoloAccuracy()) * 100) | number:'1.0-0' }}%
            </span>
            <span class="cc-vs-label">{{ getCollabAccuracy() > getSoloAccuracy() ? 'AI Helped' : getCollabAccuracy() < getSoloAccuracy() ? 'AI Hindered' : 'No Difference' }}</span>
          </div>
          <div class="cc-card collab">
            <span class="cc-icon">🤝</span>
            <h4>Collab Mode</h4>
            <span class="cc-acc" [class.good]="getCollabAccuracy() >= 0.7">{{ getCollabAccuracy() * 100 | number:'1.0-0' }}%</span>
            <span class="cc-sessions">{{ getCollabCount() }} sessions</span>
          </div>
        </div>
      </div>
      }

      <!-- Per-Agent Performance Across All Sessions -->
      <div class="section agent-history-section">
        <h2>🌍 Agent Performance — Across All Sessions</h2>
        <p class="section-desc">Aggregate accuracy of each continental AI agent</p>
        <div class="agent-history-grid">
          @for (a of getAggregateAgentPerformance(); track a.region) {
          <div class="ah-card">
            <div class="ah-header">
              <span class="ah-flag">{{ getRegionFlag(a.region) }}</span>
              <span class="ah-name">{{ a.region }}</span>
            </div>
            <div class="ah-bar-wrap">
              <div class="ah-bar" [style.width.%]="a.accuracy * 100"
                [class.high]="a.accuracy >= 0.7"
                [class.mid]="a.accuracy >= 0.5 && a.accuracy < 0.7"
                [class.low]="a.accuracy < 0.5"></div>
            </div>
            <div class="ah-stats">
              <span>{{ a.accuracy * 100 | number:'1.0-0' }}%</span>
              <span class="ah-detail">{{ a.correct }}/{{ a.total }}</span>
            </div>
          </div>
          }
        </div>
      </div>

      }
    </div>
    }
  `,
  styles: [`
    .results-container {
      max-width: 1000px; margin: 0 auto; padding: 2rem;
      display: flex; flex-direction: column; gap: 2rem;
    }
    .results-hero {
      text-align: center; padding: 2rem;
      background: var(--bg-secondary);
      border-radius: var(--radius-full); border: 1px solid var(--border-subtle);
      .hero-icon { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
      h1 { margin: 0 0 0.4rem; color: var(--text-primary); font-size: 1.75rem; }
      .hero-sub { color: var(--text-muted); font-size: 0.95rem; margin: 0 0 1rem; }
    }
    .mode-badge {
      display: inline-block; padding: 0.4rem 1.25rem; border-radius: var(--radius-full);
      font-size: 0.85rem; font-weight: 600;
      background: var(--cat-a-bg); color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      &.collab { background: var(--cat-c-bg); color: var(--accent-tertiary); border-color: var(--accent-tertiary); }
    }
    .section {
      background: var(--bg-secondary);
      border-radius: var(--radius-lg); padding: 1.75rem; border: 1px solid var(--border-subtle);
      h2 { margin: 0 0 1.25rem; color: var(--text-primary); font-size: 1.15rem; }
    }
    .section-desc { color: var(--text-muted); font-size: 0.82rem; margin: -0.75rem 0 1rem; }
    .truth-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .truth-card {
      text-align: center; padding: 1.25rem; border-radius: var(--radius-md);
      background: var(--bg-glass); border: 1px solid var(--border-subtle);
      .tc-value { display: block; font-size: 2rem; font-weight: 700; color: var(--accent-primary); }
      .tc-label { font-size: 0.75rem; color: var(--text-muted); }
      &.ai .tc-value { color: var(--label-ai); }
      &.human .tc-value { color: var(--label-human); }
    }
    .comparison-chart { display: flex; flex-direction: column; gap: 0.75rem; }
    .comp-row {
      display: grid; grid-template-columns: 140px 1fr 55px 55px; gap: 0.75rem; align-items: center;
      &.human-row { padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.25rem; }
    }
    .comp-label { display: flex; align-items: center; gap: 0.5rem; }
    .comp-icon { font-size: 1.1rem; }
    .comp-name { font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; }
    .comp-bar-wrap { height: 20px; background: var(--bg-elevated); border-radius: 4px; overflow: hidden; }
    .comp-bar {
      height: 100%; border-radius: 4px; transition: width 0.6s;
      &.human-bar { background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); }
      &.agent-bar { background: rgba(179,146,240,0.5); }
      &.agent-bar.better { background: linear-gradient(90deg, var(--status-confirm), var(--cat-f)); }
      &.agent-bar.worse { background: rgba(212,119,102,0.4); }
    }
    .comp-pct { font-size: 0.85rem; color: var(--text-primary); font-weight: 700; text-align: right; }
    .comp-detail { font-size: 0.7rem; color: var(--text-muted); text-align: right; }
    .output-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; align-items: center; }
    .output-card { display: flex; justify-content: center; }
    .output-donut { position: relative; width: 120px; height: 120px; }
    .donut-svg { width: 100%; height: 100%; }
    .donut-bg, .donut-ai, .donut-human {
      fill: none; stroke-width: 3; stroke-linecap: round;
    }
    .donut-bg { stroke: var(--border-subtle); }
    .donut-ai { stroke: var(--label-ai); stroke-dashoffset: 25; }
    .donut-human { stroke: var(--label-human); stroke-dashoffset: 25; }
    .donut-center {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      display: flex; flex-direction: column; align-items: center;
      .donut-val { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
      .donut-label { font-size: 0.65rem; color: var(--text-muted); }
    }
    .output-stats { display: flex; flex-direction: column; gap: 0.6rem; }
    .os-row {
      display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted);
      padding: 0.4rem 0; border-bottom: 1px solid var(--border-subtle);
    }
    .os-val {
      font-weight: 600; color: var(--text-secondary);
      &.good { color: var(--status-confirm); }
      &.bad { color: var(--status-critical); }
    }
    .agent-output-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;
    }
    .agent-output-card {
      padding: 1rem; border-radius: var(--radius-md); background: var(--bg-glass);
      border: 1px solid var(--border-subtle);
    }
    .aoc-header {
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;
      .aoc-flag { font-size: 1.2rem; }
      .aoc-name { font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; flex: 1; }
      .aoc-accuracy {
        font-size: 0.8rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: var(--radius-sm);
        &.good { background: var(--status-confirm-bg); color: var(--status-confirm); }
        &.bad { background: var(--status-critical-bg); color: var(--status-critical); }
      }
    }
    .aoc-bar {
      display: flex; height: 28px; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 0.5rem;
    }
    .aoc-ai-fill {
      background: linear-gradient(90deg, rgba(179,146,240,0.4), rgba(179,146,240,0.6));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; color: var(--text-inverse); font-weight: 600; min-width: 40px;
    }
    .aoc-human-fill {
      background: linear-gradient(90deg, rgba(88,166,255,0.4), rgba(88,166,255,0.6));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; color: var(--text-inverse); font-weight: 600; min-width: 40px;
    }
    .aoc-details {
      display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted);
    }
    .agreement-grid { display: flex; flex-direction: column; gap: 0.6rem; }
    .agreement-card {
      display: grid; grid-template-columns: 30px 90px 1fr 50px; gap: 0.75rem; align-items: center;
    }
    .ag-flag { font-size: 1.1rem; text-align: center; }
    .ag-region { font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; }
    .ag-bar-wrap { height: 14px; background: var(--bg-elevated); border-radius: 4px; overflow: hidden; }
    .ag-bar {
      height: 100%; border-radius: 4px; transition: width 0.5s;
      &.high { background: linear-gradient(90deg, var(--status-confirm), var(--cat-f)); }
      &.mid { background: linear-gradient(90deg, var(--status-notice), var(--cat-b)); }
      &.low { background: linear-gradient(90deg, var(--status-critical), var(--cat-e)); }
    }
    .ag-rate { font-size: 0.8rem; color: var(--text-primary); font-weight: 600; text-align: right; }
    .indicator-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;
    }
    .indicator-card {
      text-align: center; padding: 1.25rem; border-radius: var(--radius-md);
      background: var(--bg-glass); border: 1px solid var(--border-subtle);
      display: flex; flex-direction: column; gap: 0.4rem; align-items: center;
      .ind-icon { font-size: 1.5rem; }
      .ind-label { font-size: 0.72rem; color: var(--text-muted); }
      .ind-value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
      .ind-value.good { color: var(--status-confirm); }
      .ind-value.bad { color: var(--status-critical); }
    }
    .indicator-summary {
      background: var(--bg-glass); border-radius: var(--radius-md); padding: 1rem 1.25rem;
      border: 1px solid var(--border-subtle);
      p { margin: 0; color: var(--text-muted); font-size: 0.85rem; line-height: 1.7; }
    }
    .breakdown-table { overflow-x: auto; }
    .bt-header, .bt-row {
      display: grid;
      grid-template-columns: 35px 1fr 55px 55px repeat(7, 40px);
      gap: 0.4rem; align-items: center; padding: 0.5rem 0;
    }
    .bt-header {
      border-bottom: 1px solid var(--border-default);
      .bt-col { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; }
    }
    .bt-row {
      border-bottom: 1px solid var(--border-subtle);
      &:hover { background: var(--bg-glass); }
    }
    .bt-col { font-size: 0.72rem; color: var(--text-secondary); }
    .bt-num { text-align: center; color: var(--text-muted); }
    .bt-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-ai { color: var(--label-ai); font-weight: 600; }
    .label-human { color: var(--label-human); font-weight: 600; }
    .cell-correct { color: var(--label-human); font-weight: 600; }
    .cell-wrong { color: var(--status-critical); font-weight: 600; }
    .bt-agents { text-align: center; font-size: 0.6rem; }
    .results-actions {
      display: flex; gap: 1rem; justify-content: center;
    }
    .action-btn {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 2rem;
      border-radius: var(--radius-md); cursor: pointer; font-size: 0.95rem; font-weight: 600;
      border: none; transition: all 0.3s; min-height: var(--min-touch-target);
      &:hover { transform: translateY(-2px); }
    }
    .retry-btn {
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: var(--text-inverse);
      &:hover { box-shadow: var(--shadow-lg); }
    }
    .collab-btn {
      background: linear-gradient(135deg, var(--accent-tertiary), var(--accent-primary)); color: var(--text-inverse);
      &:hover { box-shadow: var(--shadow-lg); }
    }

    /* ════════════  PERSONA SECTION  ════════════ */
    .persona-section h2 { color: var(--text-primary); }
    .persona-card {
      display: flex; align-items: center; gap: 1.5rem;
      padding: 1.5rem 2rem; border-radius: 1rem;
      background: linear-gradient(135deg, rgba(139,92,246,.12), rgba(59,130,246,.08));
      border: 1px solid rgba(139,92,246,.25);
    }
    .persona-icon { font-size: 3rem; }
    .persona-info { flex: 1; }
    .persona-title { margin: 0 0 .25rem; font-size: 1.4rem; color: var(--text-primary); }
    .persona-desc { margin: 0; font-size: .9rem; color: var(--text-secondary); line-height: 1.5; }
    .persona-stats { display: flex; gap: 1.5rem; }
    .ps-item { display: flex; flex-direction: column; align-items: center; }
    .ps-val { font-size: 1.5rem; font-weight: 700; color: var(--accent-primary); }
    .ps-label { font-size: .75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .05em; }

    /* ════════════  HISTORY TABLE  ════════════ */
    .history-section h2 { color: var(--text-primary); }
    .section-desc { color: var(--text-secondary); font-size: .9rem; margin: -.5rem 0 1rem; }
    .history-table { border-radius: .75rem; overflow: hidden; border: 1px solid var(--border-color); }
    .ht-header, .ht-row {
      display: grid;
      grid-template-columns: 40px 1fr 60px 50px 90px 70px 80px 70px 90px;
      padding: .6rem 1rem; gap: .5rem; align-items: center;
    }
    .ht-header {
      background: rgba(59,130,246,.1); font-weight: 600; font-size: .75rem;
      color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em;
    }
    .ht-row {
      font-size: .85rem; color: var(--text-primary);
      border-top: 1px solid var(--border-color);
      transition: background .15s;
      &:hover { background: rgba(255,255,255,.04); }
    }
    .ht-row.current-session { background: rgba(16,185,129,.08); border-left: 3px solid var(--accent-secondary); }
    .ht-col.good { color: var(--accent-secondary); font-weight: 600; }
    .ht-col.bad { color: var(--accent-danger); font-weight: 600; }
    .mode-chip {
      display: inline-block; padding: .1rem .4rem; border-radius: .3rem; font-size: .8rem;
      background: rgba(99,102,241,.15);
      &.collab { background: rgba(16,185,129,.15); }
    }

    /* ════════════  PATTERN CARDS  ════════════ */
    .pattern-section h2 { color: var(--text-primary); }
    .pattern-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .pattern-card {
      padding: 1.2rem; border-radius: .75rem; text-align: center;
      background: var(--bg-card); border: 1px solid var(--border-color);
    }
    .pattern-card h4 { margin: 0 0 .5rem; font-size: .8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; }
    .pat-big { display: block; font-size: 2rem; font-weight: 700; color: var(--text-primary); }
    .pat-big.good { color: var(--accent-secondary); }
    .pat-big.over { color: #f59e0b; }
    .pat-big.under { color: #8b5cf6; }
    .pat-sub { display: block; font-size: .78rem; color: var(--text-secondary); margin-top: .25rem; }
    .pat-bar-wrap { margin-top: .75rem; height: 6px; background: rgba(255,255,255,.08); border-radius: 3px; overflow: hidden; }
    .pat-bar { height: 100%; border-radius: 3px; transition: width .4s ease; }
    .ai-bar { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
    .truth-bar { background: linear-gradient(90deg, #10b981, #34d399); }

    /* ════════════  COLLAB COMPARE  ════════════ */
    .collab-compare-section h2 { color: var(--text-primary); }
    .collab-compare-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1.5rem; align-items: center; }
    .cc-card {
      padding: 1.5rem; border-radius: .75rem; text-align: center;
      background: var(--bg-card); border: 1px solid var(--border-color);
    }
    .cc-card.vs { background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: .3rem; }
    .cc-icon { font-size: 2rem; }
    .cc-card h4 { margin: .5rem 0; font-size: .85rem; color: var(--text-secondary); }
    .cc-acc { display: block; font-size: 2.5rem; font-weight: 700; color: var(--text-primary); }
    .cc-acc.good { color: var(--accent-secondary); }
    .cc-sessions { font-size: .78rem; color: var(--text-secondary); }
    .cc-vs-icon { font-size: 2rem; }
    .cc-delta { font-size: 1.8rem; font-weight: 700; }
    .cc-delta.positive { color: var(--accent-secondary); }
    .cc-delta.negative { color: var(--accent-danger); }
    .cc-vs-label { font-size: .8rem; color: var(--text-secondary); }

    /* ════════════  AGENT HISTORY  ════════════ */
    .agent-history-section h2 { color: var(--text-primary); }
    .agent-history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
    .ah-card {
      padding: 1rem; border-radius: .75rem;
      background: var(--bg-card); border: 1px solid var(--border-color);
    }
    .ah-header { display: flex; align-items: center; gap: .5rem; margin-bottom: .6rem; }
    .ah-flag { font-size: 1.2rem; }
    .ah-name { font-weight: 600; font-size: .9rem; color: var(--text-primary); }
    .ah-bar-wrap { height: 8px; background: rgba(255,255,255,.08); border-radius: 4px; overflow: hidden; }
    .ah-bar { height: 100%; border-radius: 4px; transition: width .4s ease; }
    .ah-bar.high { background: linear-gradient(90deg, #10b981, #34d399); }
    .ah-bar.mid { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .ah-bar.low { background: linear-gradient(90deg, #ef4444, #f87171); }
    .ah-stats { display: flex; justify-content: space-between; margin-top: .4rem; font-size: .85rem; }
    .ah-stats span:first-child { font-weight: 600; color: var(--text-primary); }
    .ah-detail { color: var(--text-secondary); }

    @media (forced-colors: active) {
      .action-btn { border: 2px solid ButtonText; }
      .comp-bar, .ag-bar, .aoc-ai-fill, .aoc-human-fill { forced-color-adjust: none; }
    }
    @media (max-width: 700px) {
      .output-grid { grid-template-columns: 1fr; }
      .agent-output-grid { grid-template-columns: 1fr; }
      .comp-row { grid-template-columns: 100px 1fr 45px 45px; }
      .truth-grid { grid-template-columns: 1fr; }
      .persona-card { flex-direction: column; text-align: center; }
      .persona-stats { flex-wrap: wrap; justify-content: center; }
      .ht-header, .ht-row { grid-template-columns: 30px 1fr 50px 50px 70px; font-size: .75rem; }
      .ht-col.ht-said-ai, .ht-col.ht-said-hum, .ht-col.ht-actual-ai, .ht-col.ht-best-agent { display: none; }
      .pattern-grid { grid-template-columns: repeat(2, 1fr); }
      .collab-compare-grid { grid-template-columns: 1fr; }
      .cc-card.vs { flex-direction: row; gap: 1rem; }
    }
  `]
})
export class SurveyResultsComponent implements OnInit {
  surveyService = inject(SurveyService);
  private readonly api = inject(ApiService);

  continents: Continent[] = ['Africa', 'Asia', 'Europe', 'North_America', 'South_America', 'Antarctica', 'Australia'];
  pastSessions = signal<SessionSummary[]>([]);
  Math = Math; // expose for template

  private regionFlags: Record<string, string> = {
    'Africa': '🌍', 'Asia': '🌏', 'Europe': '🇪🇺', 'North_America': '🌎', 'South_America': '🌎', 'Antarctica': '🧊', 'Australia': '🦘',
  };

  ngOnInit(): void {
    this.loadSessions();
  }

  private loadSessions(): void {
    this.api.getAllSessions().subscribe({
      next: (res) => this.pastSessions.set(res.sessions ?? []),
      error: () => this.pastSessions.set([]),
    });
  }

  // ─── Existing helpers ───────────────────────────────────────────

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
    this.surveyService.startSession(false);
  }

  retakeCollab(): void {
    const currentCollab = this.surveyService.results()?.collabMode ?? false;
    this.surveyService.startSession(!currentCollab);
  }

  getBestAgentAccuracy(r: { agentResults: { accuracy: number }[] }): number {
    return Math.max(...r.agentResults.map(a => a.accuracy));
  }

  getAvgAgentAccuracy(r: { agentResults: { accuracy: number }[] }): number {
    const sum = r.agentResults.reduce((s, a) => s + a.accuracy, 0);
    return sum / r.agentResults.length;
  }

  // ─── Performance Persona ───────────────────────────────────────

  getPersonaTitle(): string {
    const acc = this.getOverallAccuracy();
    const bias = this.getTotalSaidAi() - this.getTotalActualAi();
    if (acc >= 0.8 && Math.abs(bias) <= 1) return 'Precision Analyst';
    if (acc >= 0.7 && bias > 1) return 'AI Skeptic';
    if (acc >= 0.7 && bias < -1) return 'Human Truster';
    if (acc >= 0.5) return 'Balanced Detector';
    return 'Developing Observer';
  }

  getPersonaIcon(): string {
    const title = this.getPersonaTitle();
    const icons: Record<string, string> = {
      'Precision Analyst': '🎯', 'AI Skeptic': '🔬', 'Human Truster': '🤗',
      'Balanced Detector': '⚖️', 'Developing Observer': '🔭',
    };
    return icons[title] ?? '🧩';
  }

  getPersonaDescription(): string {
    const title = this.getPersonaTitle();
    const descs: Record<string, string> = {
      'Precision Analyst': 'Highly accurate with minimal bias — you identify AI and human content with near-equal precision.',
      'AI Skeptic': 'You tend to flag content as AI-generated more often than average, but maintain solid accuracy.',
      'Human Truster': 'You lean toward marking content as human-authored. You may underestimate AI prevalence.',
      'Balanced Detector': 'Moderate accuracy with a balanced selection pattern. Room to sharpen detection skills.',
      'Developing Observer': 'Still building your detection instincts — keep practising to improve!',
    };
    return descs[title] ?? '';
  }

  // ─── Aggregate stats across all sessions ────────────────────────

  getOverallAccuracy(): number {
    const s = this.pastSessions();
    if (!s.length) return 0;
    const totalCorrect = s.reduce((sum, x) => sum + x.humanCorrect, 0);
    const totalItems = s.reduce((sum, x) => sum + x.totalItems, 0);
    return totalItems ? totalCorrect / totalItems : 0;
  }

  getTotalItems(): number {
    return this.pastSessions().reduce((sum, x) => sum + x.totalItems, 0);
  }

  getTotalCorrect(): number {
    return this.pastSessions().reduce((sum, x) => sum + x.humanCorrect, 0);
  }

  getTotalSaidAi(): number {
    return this.pastSessions().reduce((sum, x) => sum + x.humanAiCount, 0);
  }

  getTotalActualAi(): number {
    return this.pastSessions().reduce((sum, x) => sum + x.actualAiCount, 0);
  }

  getBestAgentAccForSession(s: SessionSummary): number {
    if (!s.agentResults?.length) return 0;
    return Math.max(...s.agentResults.map(a => a.accuracy));
  }

  // ─── Solo vs Collab comparison ──────────────────────────────────

  hasBothModes(): boolean {
    const s = this.pastSessions();
    return s.some(x => x.collabMode) && s.some(x => !x.collabMode);
  }

  getSoloAccuracy(): number {
    const solo = this.pastSessions().filter(x => !x.collabMode);
    if (!solo.length) return 0;
    const c = solo.reduce((s, x) => s + x.humanCorrect, 0);
    const t = solo.reduce((s, x) => s + x.totalItems, 0);
    return t ? c / t : 0;
  }

  getCollabAccuracy(): number {
    const collab = this.pastSessions().filter(x => x.collabMode);
    if (!collab.length) return 0;
    const c = collab.reduce((s, x) => s + x.humanCorrect, 0);
    const t = collab.reduce((s, x) => s + x.totalItems, 0);
    return t ? c / t : 0;
  }

  getSoloCount(): number {
    return this.pastSessions().filter(x => !x.collabMode).length;
  }

  getCollabCount(): number {
    return this.pastSessions().filter(x => x.collabMode).length;
  }

  // ─── Aggregate agent performance ───────────────────────────────

  getAggregateAgentPerformance(): { region: string; correct: number; total: number; accuracy: number }[] {
    const map = new Map<string, { correct: number; total: number }>();
    for (const s of this.pastSessions()) {
      for (const a of (s.agentResults ?? [])) {
        const cur = map.get(a.region) ?? { correct: 0, total: 0 };
        cur.correct += a.correct;
        cur.total += s.totalItems;
        map.set(a.region, cur);
      }
    }
    return Array.from(map.entries()).map(([region, v]) => ({
      region,
      correct: v.correct,
      total: v.total,
      accuracy: v.total ? v.correct / v.total : 0,
    }));
  }
}

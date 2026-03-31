import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { BiasResult, AgentScore, BiasDetection } from '../../models/post.model';
import { getScoreLabel, getScoreColor } from '../../utils/score-utils';

@Component({
  selector: 'app-bias-details-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="modal-overlay" (click)="close.emit()" *ngIf="visible">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>🔍 Bias Analysis Details</h2>
          <button class="close-btn" (click)="close.emit()">✕</button>
        </div>
        <div class="disclaimer">⚠️ BIAS SIMULATOR — Research prototype for studying regional AI bias patterns</div>

        <div class="result-grid" *ngIf="result">
          <div class="result-card raw">
            <h4>Raw Biased Score</h4>
            <span class="score-val">{{ result.rawBiasedScore | number:'1.3-3' }}</span>
            <span class="score-label">{{ getLabel(result.rawBiasedScore) }}</span>
          </div>
          <div class="result-card baseline">
            <h4>Baseline Score</h4>
            <span class="score-val">{{ result.baselineNonbiasedScore | number:'1.3-3' }}</span>
            <span class="score-label">{{ getLabel(result.baselineNonbiasedScore) }}</span>
          </div>
          <div class="result-card debiased">
            <h4>Debiased Score</h4>
            <span class="score-val">{{ result.debiasedAdjustedScore | number:'1.3-3' }}</span>
            <span class="score-label">{{ getLabel(result.debiasedAdjustedScore) }}</span>
          </div>
        </div>

        <!-- Agent-by-Agent Breakdown -->
        <div class="agents-section" *ngIf="agentScores.length > 0">
          <h3 class="section-title">🌍 Regional Agent Scores</h3>
          <div class="agent-table">
            <div class="agent-row header-row">
              <span class="col-region">Region</span>
              <span class="col-score">Score</span>
              <span class="col-conf">Confidence</span>
              <span class="col-reasoning">Reasoning</span>
            </div>
            <div class="agent-row" *ngFor="let a of agentScores"
                 [class.most-biased]="a.agentName === biasDetection?.mostBiasedAgent"
                 [class.least-biased]="a.agentName === biasDetection?.leastBiasedAgent">
              <span class="col-region">
                <span class="region-flag">{{ getRegionFlag(a.region) }}</span>
                {{ a.region ?? 'Baseline' }}
              </span>
              <span class="col-score" [style.color]="getColor(a.score)">{{ a.score | number:'1.3-3' }}</span>
              <span class="col-conf">{{ a.confidence * 100 | number:'1.0-0' }}%</span>
              <span class="col-reasoning">{{ a.reasoning }}</span>
            </div>
          </div>
        </div>

        <!-- Bias Detection Report -->
        <div class="detection-section" *ngIf="biasDetection">
          <h3 class="section-title">🔬 Bias Detection Report</h3>
          <div class="detection-meta">
            <span class="detection-chip">Most biased: <strong>{{ biasDetection.mostBiasedAgent }}</strong></span>
            <span class="detection-chip safe">Least biased: <strong>{{ biasDetection.leastBiasedAgent }}</strong></span>
            <span class="detection-chip" [class]="'level-' + biasDetection.overallBiasLevel">
              Level: <strong>{{ biasDetection.overallBiasLevel | uppercase }}</strong>
            </span>
          </div>
          <p class="detection-summary-text">{{ biasDetection.summary }}</p>

          <div class="flagged-list" *ngIf="biasDetection.flaggedItems.length">
            <h4 class="flagged-title">Flagged Items</h4>
            <div class="flag-item" *ngFor="let f of biasDetection.flaggedItems">
              <div class="flag-header">
                <span class="flag-agent">{{ getRegionFlag(f.region) }} {{ f.agentName }}</span>
                <span class="flag-mode" [class]="'mode-' + f.biasMode.toLowerCase()">{{ f.biasMode }}</span>
                <span class="flag-severity" [class]="'sev-' + f.severity">{{ f.severity }}</span>
                <span class="flag-delta">Δ {{ f.deltaFromBaseline | number:'1.3-3' }}</span>
              </div>
              <p class="flag-explanation">{{ f.explanation }}</p>
            </div>
          </div>
        </div>

        <div class="details-section" *ngIf="result">
          <h3 class="section-title">📐 Detailed Metrics</h3>
          <div class="detail-row">
            <span class="detail-label">Bias Delta</span>
            <span class="detail-value delta">{{ result.biasDelta | number:'1.4-4' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Deducted Amount</span>
            <span class="detail-value">{{ result.deductedBiasAmount | number:'1.4-4' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amplification Index</span>
            <span class="detail-value">{{ result.biasAmplificationIndex | number:'1.4-4' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Disagreement Rate</span>
            <span class="detail-value">{{ result.disagreementRate | number:'1.4-4' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Region Dominance</span>
            <span class="detail-value">{{ result.regionDominanceScore | number:'1.4-4' }}</span>
          </div>
          <div class="detail-row" *ngIf="result.dominantBiasedAgent">
            <span class="detail-label">Dominant Agent</span>
            <span class="detail-value agent">{{ result.dominantBiasedAgent }}</span>
          </div>
          <div class="detail-row" *ngIf="result.favoredRegion">
            <span class="detail-label">Favored Region</span>
            <span class="detail-value region">{{ result.favoredRegion }}</span>
          </div>
          <div class="detail-row" *ngIf="result.favoredSegments.length > 0">
            <span class="detail-label">Favored Segments</span>
            <span class="detail-value">{{ result.favoredSegments.join(', ') }}</span>
          </div>
          <div class="explanation" *ngIf="result.explanationSummary">
            <h4>Explanation</h4>
            <p>{{ result.explanationSummary }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); z-index: 1000; display: flex;
      align-items: center; justify-content: center; backdrop-filter: blur(4px);
    }
    .modal-content {
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 20px; padding: 2rem; max-width: 750px; width: 92%;
      max-height: 85vh; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;
      h2 { margin: 0; color: #e6e6e6; font-size: 1.25rem; }
    }
    .close-btn {
      background: rgba(255,255,255,0.1); border: none; color: #8892b0;
      width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
      font-size: 1rem; transition: all 0.3s;
      &:hover { background: rgba(255,255,255,0.2); color: #e6e6e6; }
    }
    .disclaimer {
      background: rgba(255,107,107,0.15); color: #ff6b6b; text-align: center;
      padding: 0.4rem; border-radius: 8px; font-size: 0.7rem; font-weight: 600;
      margin-bottom: 1.5rem; letter-spacing: 0.5px;
    }
    .section-title {
      margin: 1.25rem 0 0.75rem; color: #e6e6e6; font-size: 0.95rem; font-weight: 600;
      padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .result-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 0.5rem;
    }
    .result-card {
      text-align: center; padding: 1rem; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.05);
      h4 { margin: 0 0 0.5rem; font-size: 0.75rem; color: #8892b0; }
      .score-val { display: block; font-size: 1.5rem; font-weight: 700; }
      .score-label { font-size: 0.7rem; }
      &.raw { background: rgba(233,30,99,0.1); .score-val { color: #e91e63; } }
      &.baseline { background: rgba(158,158,158,0.1); .score-val { color: #ccd6f6; } }
      &.debiased { background: rgba(0,217,255,0.1); .score-val { color: #00d9ff; } }
    }

    /* Agent Table */
    .agent-table { display: flex; flex-direction: column; gap: 0.25rem; }
    .agent-row {
      display: grid; grid-template-columns: 120px 70px 70px 1fr; gap: 0.5rem;
      padding: 0.5rem; border-radius: 6px; align-items: center;
      &.header-row { font-size: 0.7rem; color: #5a6480; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      &:not(.header-row) { background: rgba(255,255,255,0.02); }
      &.most-biased { border-left: 3px solid #e91e63; background: rgba(233,30,99,0.05); }
      &.least-biased { border-left: 3px solid #4caf50; background: rgba(76,175,80,0.05); }
    }
    .col-region { font-size: 0.78rem; color: #ccd6f6; display: flex; align-items: center; gap: 0.3rem; }
    .region-flag { font-size: 1rem; }
    .col-score { font-size: 0.85rem; font-weight: 700; }
    .col-conf { font-size: 0.75rem; color: #8892b0; }
    .col-reasoning { font-size: 0.7rem; color: #8892b0; line-height: 1.4; }

    /* Detection */
    .detection-meta { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem; }
    .detection-chip {
      font-size: 0.68rem; padding: 0.2rem 0.5rem; border-radius: 8px;
      background: rgba(233,30,99,0.1); color: #e91e63;
      &.safe { background: rgba(76,175,80,0.1); color: #4caf50; }
      &.level-low { background: rgba(76,175,80,0.1); color: #4caf50; }
      &.level-medium { background: rgba(255,152,0,0.1); color: #ff9800; }
      &.level-high { background: rgba(233,30,99,0.1); color: #e91e63; }
      &.level-critical { background: rgba(244,67,54,0.12); color: #f44336; }
    }
    .detection-summary-text { margin: 0 0 0.5rem; font-size: 0.78rem; color: #8892b0; line-height: 1.5; }
    .flagged-title { margin: 0.5rem 0 0.3rem; font-size: 0.8rem; color: #e6e6e6; }
    .flagged-list { display: flex; flex-direction: column; gap: 0.35rem; }
    .flag-item { padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 6px; border-left: 3px solid rgba(255,152,0,0.4); }
    .flag-header { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.2rem; }
    .flag-agent { font-size: 0.72rem; color: #ccd6f6; font-weight: 500; }
    .flag-mode {
      font-size: 0.55rem; font-weight: 700; padding: 0.1rem 0.3rem; border-radius: 4px;
      &.mode-inflation { background: rgba(233,30,99,0.15); color: #e91e63; }
      &.mode-deflation { background: rgba(33,150,243,0.15); color: #2196f3; }
      &.mode-selective { background: rgba(255,152,0,0.15); color: #ff9800; }
      &.mode-neutral { background: rgba(158,158,158,0.15); color: #9e9e9e; }
    }
    .flag-severity {
      font-size: 0.55rem; font-weight: 600; padding: 0.1rem 0.3rem; border-radius: 4px;
      &.sev-negligible { background: rgba(158,158,158,0.12); color: #9e9e9e; }
      &.sev-low { background: rgba(76,175,80,0.12); color: #4caf50; }
      &.sev-medium { background: rgba(255,152,0,0.12); color: #ff9800; }
      &.sev-high { background: rgba(233,30,99,0.12); color: #e91e63; }
      &.sev-critical { background: rgba(244,67,54,0.15); color: #f44336; }
    }
    .flag-delta { font-size: 0.65rem; color: #ff9800; }
    .flag-explanation { margin: 0; font-size: 0.68rem; color: #8892b0; line-height: 1.4; }

    .details-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .detail-row {
      display: flex; justify-content: space-between; padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .detail-label { font-size: 0.85rem; color: #8892b0; }
    .detail-value { font-size: 0.85rem; color: #ccd6f6; font-weight: 600;
      &.delta { color: #ff9800; }
      &.agent { color: #e91e63; }
      &.region { color: #00d9ff; }
    }
    .explanation {
      margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.02);
      border-radius: 8px; border-left: 3px solid #00d9ff;
      h4 { margin: 0 0 0.5rem; color: #e6e6e6; font-size: 0.9rem; }
      p { margin: 0; color: #8892b0; font-size: 0.85rem; line-height: 1.6; }
    }
    @media (max-width: 500px) {
      .result-grid { grid-template-columns: 1fr; }
      .agent-row { grid-template-columns: 1fr; }
    }
  `]
})
export class BiasDetailsModalComponent {
  @Input() result: BiasResult | null = null;
  @Input() agentScores: AgentScore[] = [];
  @Input() biasDetection: BiasDetection | null = null;
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();

  private regionFlags: Record<string, string> = {
    'Africa': '🌍', 'Asia': '🌏', 'Europe': '🇪🇺', 'Americas': '🌎', 'Oceania': '🏝️'
  };

  getLabel(score: number): string { return getScoreLabel(score); }
  getColor(score: number): string { return getScoreColor(score); }
  getRegionFlag(region: string | null): string { return region ? (this.regionFlags[region] ?? '🌐') : '⚖️'; }
}

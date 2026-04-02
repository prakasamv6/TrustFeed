import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-transparency-panel',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <!-- Backdrop -->
    <div class="tp-backdrop" (click)="close.emit()" aria-hidden="true"></div>

    <!-- Panel -->
    <aside
      class="tp-panel"
      role="dialog"
      aria-labelledby="tp-title"
      aria-describedby="tp-desc"
      (keydown.escape)="close.emit()">

      <div class="tp-header">
        <div>
          <h2 id="tp-title" class="tp-title">
            <app-icon name="transparency" [size]="22" />
            AI Transparency
          </h2>
          <p id="tp-desc" class="tp-subtitle">How TrustFeed works and what data is used</p>
        </div>
        <button (click)="close.emit()" aria-label="Close transparency panel" class="close-btn">
          <app-icon name="x-close" [size]="20" />
        </button>
      </div>

      <div class="tp-body">
        <!-- Data Collection -->
        <section class="tp-section" aria-labelledby="tp-data">
          <h3 id="tp-data" class="tp-section-title">
            <app-icon name="lock" [size]="16" />
            Data Collection &amp; Privacy
          </h3>
          <div class="tp-card">
            <p>TrustFeed is a <strong>research application</strong>. Here's what happens with your data:</p>
            <ul class="tp-list">
              <li>
                <app-icon name="check" [size]="14" color="var(--accent-green)" />
                <span>All data stays in your browser (localStorage/sessionStorage)</span>
              </li>
              <li>
                <app-icon name="check" [size]="14" color="var(--accent-green)" />
                <span>No personal information is collected or transmitted</span>
              </li>
              <li>
                <app-icon name="check" [size]="14" color="var(--accent-green)" />
                <span>Preferences (theme, layout) are stored locally for convenience</span>
              </li>
              <li>
                <app-icon name="check" [size]="14" color="var(--accent-green)" />
                <span>Behavioral signals (scroll, clicks) are processed in-memory only</span>
              </li>
            </ul>
            <button class="btn-ghost tp-clear-btn" (click)="clearAllData()">
              <app-icon name="danger" [size]="14" />
              Clear All Stored Data
            </button>
          </div>
        </section>

        <!-- AI Methodology -->
        <section class="tp-section" aria-labelledby="tp-methods">
          <h3 id="tp-methods" class="tp-section-title">
            <app-icon name="brain" [size]="16" />
            AI Detection Methodology
          </h3>
          <div class="tp-card">
            <p>TrustFeed simulates multi-regional bias in AI content detection:</p>
            <ol class="tp-steps">
              <li>
                <strong>5 Regional Agents</strong> — Each applies culturally-influenced bias
                (Africa, Asia, Europe, Americas, Oceania) to score content as AI or human.
              </li>
              <li>
                <strong>Baseline Agent</strong> — A neutral control agent with no regional bias.
              </li>
              <li>
                <strong>Aggregation</strong> — Regional scores are weighted (85% agents, 15% prior)
                to produce a raw biased score.
              </li>
              <li>
                <strong>Debiasing</strong> — The baseline is compared against the raw score.
                Residual bias is clamped (±5%) to produce a debiased score.
              </li>
              <li>
                <strong>Bias Detection</strong> — Each agent is analyzed for inflation, deflation,
                or selective bias patterns.
              </li>
            </ol>
          </div>
        </section>

        <!-- Scoring Formula -->
        <section class="tp-section" aria-labelledby="tp-scoring">
          <h3 id="tp-scoring" class="tp-section-title">
            <app-icon name="target" [size]="16" />
            Scoring Formulas
          </h3>
          <div class="tp-card tp-formulas">
            <div class="formula-row">
              <span class="formula-name">Raw Biased Score</span>
              <code class="formula-code">0.85 × avg(regional_agents) + 0.15 × 0.5</code>
            </div>
            <div class="formula-row">
              <span class="formula-name">Bias Delta</span>
              <code class="formula-code">|raw_score − baseline_score|</code>
            </div>
            <div class="formula-row">
              <span class="formula-name">Debiased Score</span>
              <code class="formula-code">baseline + clamp(raw − baseline, −0.05, +0.05)</code>
            </div>
            <div class="formula-row">
              <span class="formula-name">Favoritism Flag</span>
              <code class="formula-code">max_region − mean_region > 0.60</code>
            </div>
          </div>
        </section>

        <!-- Adaptive Features -->
        <section class="tp-section" aria-labelledby="tp-adaptive">
          <h3 id="tp-adaptive" class="tp-section-title">
            <app-icon name="sparkles" [size]="16" />
            Adaptive Features
          </h3>
          <div class="tp-card">
            <ul class="tp-list">
              <li>
                <app-icon name="activity" [size]="14" color="var(--accent-cyan)" />
                <span><strong>Empathetic UX</strong> — Detects frustration (rapid clicks, fast scrolling) and offers simpler views</span>
              </li>
              <li>
                <app-icon name="lightbulb" [size]="14" color="var(--accent-orange)" />
                <span><strong>Anticipatory Suggestions</strong> — Recommends pages and actions based on your usage patterns</span>
              </li>
              <li>
                <app-icon name="shield" [size]="14" color="var(--accent-purple)" />
                <span><strong>Circuit Breaker</strong> — Pauses your session if AI content exposure exceeds safe thresholds</span>
              </li>
              <li>
                <app-icon name="zap" [size]="14" color="var(--accent-pink)" />
                <span><strong>Judgment Drift</strong> — Monitors if your voting patterns shift after AI content exposure</span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </aside>
  `,
  styles: [`
    .tp-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: var(--z-side-sheet);
      animation: fadeIn 0.2s ease-out;
    }

    .tp-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(480px, 92vw);
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-default);
      z-index: calc(var(--z-side-sheet) + 1);
      display: flex;
      flex-direction: column;
      animation: slideInRight 0.3s ease-out;
      overflow-y: auto;
    }

    .tp-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: var(--space-6);
      border-bottom: 1px solid var(--border-default);
      flex-shrink: 0;
    }

    .tp-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .tp-subtitle {
      font-size: var(--text-sm);
      color: var(--text-muted);
      margin-top: var(--space-1);
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover { background: var(--bg-hover); color: var(--text-primary); }
    }

    .tp-body {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .tp-section-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-base);
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--space-3);
    }

    .tp-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      font-size: var(--text-sm);
      color: var(--text-secondary);
      line-height: var(--leading-relaxed);

      p { margin-bottom: var(--space-3); }
    }

    .tp-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);

      li {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);

        app-icon { flex-shrink: 0; margin-top: 3px; }
      }
    }

    .tp-steps {
      padding-left: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);

      li { padding-left: var(--space-2); }
    }

    .tp-formulas {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .formula-row {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .formula-name {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .formula-code {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--accent-cyan);
      background: var(--bg-elevated);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
    }

    .tp-clear-btn {
      margin-top: var(--space-3);
      color: var(--danger-color);

      &:hover { background: var(--danger-bg); }
    }
  `]
})
export class TransparencyPanelComponent {
  @Output() close = new EventEmitter<void>();

  clearAllData(): void {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  }
}

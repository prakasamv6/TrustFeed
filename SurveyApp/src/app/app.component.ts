import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorToastComponent } from './components/error-toast/error-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ErrorToastComponent],
  template: `
    <!-- AI Influence Notification Bar -->
    @if (showAiNotice()) {
    <div class="ai-influence-bar">
      <div class="ai-influence-inner">
        <span class="ai-pulse-dot"></span>
        <span class="ai-influence-icon">🧠</span>
        <span class="ai-influence-text">
          <strong>AI-Influenced Suggestions Active</strong> — Continental agents are providing analysis-based recommendations. All AI suggestions are clearly labeled.
        </span>
        <button class="ai-influence-dismiss" (click)="dismissNotice()">✕</button>
      </div>
    </div>
    }

    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <span class="brand-icon">🛡️</span>
          <span class="brand-name">TrustFeed Survey</span>
          <span class="brand-version">v2.0</span>
        </div>
        <nav class="header-nav">
          <span class="nav-badge collab">Human-AI Collab</span>
          <span class="nav-badge research">Research Prototype</span>
          <span class="nav-badge live-badge">
            <span class="live-dot"></span>
            LIVE
          </span>
        </nav>
      </div>
    </header>
    <main>
      <router-outlet />
    </main>
    <app-error-toast />
  `,
  styles: [`
    /* AI Influence Notification Bar */
    .ai-influence-bar {
      background: linear-gradient(90deg, var(--cat-a-bg), var(--cat-c-bg), var(--cat-d-bg));
      border-bottom: 1px solid var(--border-default);
      padding: 0.5rem 2rem;
      animation: fadeInDown 0.5s ease-out;
    }
    .ai-influence-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; gap: 0.6rem;
    }
    .ai-pulse-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      background: var(--accent-primary);
      animation: pulse 2s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(88,166,255,0.5);
    }
    .ai-influence-icon { font-size: 1.1rem; flex-shrink: 0; }
    .ai-influence-text {
      font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4; flex: 1;
      strong { color: var(--accent-primary); }
    }
    .ai-influence-dismiss {
      background: none; border: 1px solid var(--border-default); color: var(--text-muted);
      width: 28px; height: 28px; min-height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.7rem;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: all 0.2s;
      &:hover { background: var(--bg-hover); color: var(--text-primary); }
    }
    @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* Header */
    .app-header {
      background: var(--bg-glass);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-default);
      padding: 0 2rem;
      position: sticky; top: 0; z-index: 100;
    }
    .header-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      height: 60px;
    }
    .brand {
      display: flex; align-items: center; gap: 0.6rem;
      .brand-icon { font-size: 1.5rem; }
      .brand-name {
        font-size: 1.15rem; font-weight: 700;
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .brand-version {
        font-size: 0.6rem; font-weight: 600; color: var(--text-muted);
        background: var(--bg-hover); padding: 0.15rem 0.4rem; border-radius: var(--radius-sm);
      }
    }
    .header-nav { display: flex; gap: 0.5rem; align-items: center; }
    .nav-badge {
      font-size: 0.72rem; font-weight: 600; padding: 0.3rem 0.8rem;
      border-radius: var(--radius-full);
      &.collab {
        background: var(--cat-c-bg); color: var(--accent-tertiary); border: 1px solid var(--accent-tertiary);
      }
      &.research {
        background: var(--cat-a-bg); color: var(--accent-primary);
        border: 1px solid var(--accent-primary);
      }
      &.live-badge {
        display: flex; align-items: center; gap: 0.35rem;
        background: var(--status-confirm-bg); color: var(--status-confirm);
        border: 1px solid var(--status-confirm); font-size: 0.65rem; font-weight: 700;
        letter-spacing: 0.5px;
      }
    }
    .live-dot {
      width: 6px; height: 6px; border-radius: 50%; background: var(--status-confirm);
      animation: pulse 1.5s ease-in-out infinite;
      box-shadow: 0 0 6px rgba(86,212,196,0.6);
    }
    main { min-height: calc(100vh - 60px); }

    @media (forced-colors: active) {
      .app-header, .ai-influence-bar { border-bottom: 1px solid CanvasText; }
      .nav-badge { border: 1px solid CanvasText; }
    }

    @media (max-width: 600px) {
      .ai-influence-bar { padding: 0.4rem 1rem; }
      .ai-influence-text { font-size: 0.68rem; }
      .header-inner { padding: 0 0.5rem; }
      .nav-badge { font-size: 0.6rem; padding: 0.2rem 0.5rem; }
    }
  `],
})
export class AppComponent {
  title = 'SurveyApp';
  showAiNotice = signal(true);

  dismissNotice(): void {
    this.showAiNotice.set(false);
  }
}

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ErrorToastComponent } from './components/error-toast/error-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ErrorToastComponent],
  template: `
    <!-- AI Influence Notification Bar -->
    <div class="ai-influence-bar" *ngIf="showAiNotice()">
      <div class="ai-influence-inner">
        <span class="ai-pulse-dot"></span>
        <span class="ai-influence-icon">🧠</span>
        <span class="ai-influence-text">
          <strong>AI-Influenced Suggestions Active</strong> — Continental agents are providing analysis-based recommendations. All AI suggestions are clearly labeled.
        </span>
        <button class="ai-influence-dismiss" (click)="dismissNotice()">✕</button>
      </div>
    </div>

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
      background: linear-gradient(90deg, rgba(0,217,255,0.12), rgba(156,39,176,0.12), rgba(0,255,136,0.08));
      border-bottom: 1px solid rgba(0,217,255,0.2);
      padding: 0.5rem 2rem;
      animation: fadeInDown 0.5s ease-out;
    }
    .ai-influence-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; gap: 0.6rem;
    }
    .ai-pulse-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      background: #00d9ff;
      animation: pulse 2s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(0,217,255,0.5);
    }
    .ai-influence-icon { font-size: 1.1rem; flex-shrink: 0; }
    .ai-influence-text {
      font-size: 0.75rem; color: #ccd6f6; line-height: 1.4; flex: 1;
      strong { color: #00d9ff; }
    }
    .ai-influence-dismiss {
      background: none; border: 1px solid rgba(255,255,255,0.1); color: #8892b0;
      width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 0.7rem;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: all 0.2s;
      &:hover { background: rgba(255,255,255,0.1); color: #e6e6e6; }
    }
    @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* Header */
    .app-header {
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding: 0 2rem;
      position: sticky; top: 0; z-index: 100;
      backdrop-filter: blur(10px);
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
        font-size: 1.15rem; font-weight: 700; color: #e6e6e6;
        background: linear-gradient(135deg, #00d9ff, #00ff88);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .brand-version {
        font-size: 0.6rem; font-weight: 600; color: #5a6480;
        background: rgba(255,255,255,0.05); padding: 0.15rem 0.4rem; border-radius: 4px;
      }
    }
    .header-nav { display: flex; gap: 0.5rem; align-items: center; }
    .nav-badge {
      font-size: 0.72rem; font-weight: 600; padding: 0.3rem 0.8rem;
      border-radius: 20px;
      &.collab {
       background: rgba(156,39,176,0.12); color: #ce93d8; border: 1px solid rgba(156,39,176,0.2);
      }
      &.research {
        background: rgba(0,217,255,0.08); color: #00d9ff;
        border: 1px solid rgba(0,217,255,0.2);
      }
      &.live-badge {
        display: flex; align-items: center; gap: 0.35rem;
        background: rgba(76,175,80,0.1); color: #4caf50;
        border: 1px solid rgba(76,175,80,0.25); font-size: 0.65rem; font-weight: 700;
        letter-spacing: 0.5px;
      }
    }
    .live-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #4caf50;
      animation: pulse 1.5s ease-in-out infinite;
      box-shadow: 0 0 6px rgba(76,175,80,0.6);
    }
    main { min-height: calc(100vh - 60px); }
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

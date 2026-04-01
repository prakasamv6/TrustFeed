import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { PostService } from '../../services/post.service';
import { ExposureTrackerService } from '../../services/exposure-tracker.service';
import { ContentType } from '../../models/post.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <!-- AI Influence Notification Bar (for investigator) -->
      <div class="ai-influence-bar" *ngIf="showAiInfluence()">
        <div class="ai-influence-inner">
          <span class="ai-pulse-dot"></span>
          <span class="ai-inf-icon">🧠</span>
          <span class="ai-inf-text">
            <strong>AI-Influenced Analysis Active</strong> — 5 regional bias agents + 1 baseline are providing AI-influenced suggestions on all content. All AI suggestions are labeled.
          </span>
          <span class="ai-inf-badge">{{ exposureTracker.aiExposureCount() }} items analyzed</span>
          <button class="ai-inf-dismiss" (click)="showAiInfluence.set(false)">✕</button>
        </div>
      </div>

      <div class="disclaimer-bar">
        ⚠️ BIAS SIMULATOR — AI-Influenced Suggestions Are Clearly Marked
      </div>
      <div class="header-content">
        <a routerLink="/" class="logo">
          <span class="logo-icon">🔍</span>
          <h1>TrustFeed</h1>
          <span class="logo-version">v2.0</span>
          <span class="live-badge"><span class="live-dot"></span>LIVE</span>
          <span class="tagline">Authentic Content, Transparent AI</span>
        </a>

        <!-- Main Navigation -->
        <nav class="main-nav">
          <a 
            routerLink="/" 
            routerLinkActive="active" 
            [routerLinkActiveOptions]="{exact: true}"
            class="nav-link"
          >
            <span class="nav-icon">🏠</span>
            Feed
          </a>
          <a 
            routerLink="/review" 
            routerLinkActive="active"
            class="nav-link review-link"
          >
            <span class="nav-icon">📝</span>
            Content Review
          </a>
          <a 
            routerLink="/dashboard" 
            routerLinkActive="active"
            class="nav-link dashboard-link"
          >
            <span class="nav-icon">📊</span>
            Bias Dashboard
          </a>
          <a 
            routerLink="/survey" 
            routerLinkActive="active"
            class="nav-link survey-link"
          >
            <span class="nav-icon">📋</span>
            Survey
            <span class="new-badge">NEW</span>
          </a>
        </nav>

        <!-- Filter Nav (only shown on feed page) -->
        <nav class="filter-nav" *ngIf="isOnFeedPage()">
          <button
            *ngFor="let filter of filters"
            [class.active]="currentFilter === filter.value"
            (click)="setFilter(filter.value)"
            class="filter-btn"
          >
            <span class="filter-icon">{{ filter.icon }}</span>
            {{ filter.label }}
          </button>
        </nav>

        <div class="header-actions">
          <!-- Exposure Indicator (proposal §Overview: feedback monitoring) -->
          <div class="exposure-indicator" *ngIf="isOnFeedPage()" [class.cb-active]="exposureTracker.circuitBreaker().triggered">
            <span class="exposure-icon" [class]="'drift-' + exposureTracker.judgmentDrift().level">🧠</span>
            <span class="exposure-count">{{ exposureTracker.aiExposureCount() }} AI</span>
            <span class="exposure-drift-badge" [class]="'drift-' + exposureTracker.judgmentDrift().level" *ngIf="exposureTracker.judgmentDrift().level !== 'stable'">
              {{ exposureTracker.judgmentDrift().level }}
            </span>
          </div>

          <div class="legend" *ngIf="isOnFeedPage()">
            <div class="legend-item">
              <span class="badge ai-badge">AI</span>
              <span>AI-Generated</span>
            </div>
            <div class="legend-item">
              <span class="badge human-badge">✓</span>
              <span>Human</span>
            </div>
            <div class="legend-item">
              <span class="badge bias-badge">⚠</span>
              <span>Bias Flagged</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    /* AI Influence Notification Bar */
    .ai-influence-bar {
      background: linear-gradient(90deg, rgba(0,217,255,0.1), rgba(156,39,176,0.08), rgba(0,255,136,0.06));
      border-bottom: 1px solid rgba(0,217,255,0.15);
      padding: 0.45rem 2rem;
      animation: fadeInDown 0.5s ease-out;
    }
    .ai-influence-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .ai-pulse-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      background: #00d9ff; animation: pulseDot 2s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(0,217,255,0.5);
    }
    .ai-inf-icon { font-size: 1rem; flex-shrink: 0; }
    .ai-inf-text {
      font-size: 0.72rem; color: #ccd6f6; line-height: 1.3; flex: 1;
      strong { color: #00d9ff; }
    }
    .ai-inf-badge {
      font-size: 0.6rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 10px;
      background: rgba(0,217,255,0.1); color: #00d9ff; white-space: nowrap; flex-shrink: 0;
    }
    .ai-inf-dismiss {
      background: none; border: 1px solid rgba(255,255,255,0.1); color: #8892b0;
      width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 0.65rem;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: all 0.2s;
      &:hover { background: rgba(255,255,255,0.1); color: #e6e6e6; }
    }
    @keyframes fadeInDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    .disclaimer-bar {
      background: linear-gradient(135deg, #ff6b6b, #ff8e53);
      color: white; text-align: center; padding: 0.3rem;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 1px;
    }

    /* LIVE & Version badges */
    .logo-version {
      font-size: 0.55rem; font-weight: 600; color: #5a6480;
      background: rgba(255,255,255,0.08); padding: 0.12rem 0.35rem; border-radius: 4px;
    }
    .live-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      font-size: 0.6rem; font-weight: 700; color: #4caf50; letter-spacing: 0.5px;
      background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.25);
      padding: 0.15rem 0.5rem; border-radius: 10px;
    }
    .live-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #4caf50;
      animation: pulseDot 1.5s ease-in-out infinite;
      box-shadow: 0 0 6px rgba(76,175,80,0.6);
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      cursor: pointer;

      .logo-icon {
        font-size: 2rem;
      }

      h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        background: linear-gradient(135deg, #00d9ff, #00ff88);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .tagline {
        font-size: 0.75rem;
        color: #8892b0;
        border-left: 1px solid #8892b0;
        padding-left: 0.75rem;
        margin-left: 0.5rem;
      }
    }

    .main-nav {
      display: flex;
      gap: 0.5rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.25rem;
      border-radius: 25px;
      text-decoration: none;
      color: #ccd6f6;
      font-size: 0.9rem;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-2px);
      }

      &.active {
        background: linear-gradient(135deg, #00d9ff, #00ff88);
        color: #0a0a0f;
        font-weight: 600;
        border-color: transparent;
      }

      .nav-icon {
        font-size: 1rem;
      }
    }

    .review-link {
      position: relative;
    }

    .new-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: linear-gradient(135deg, #ff6b6b, #ff8e53);
      color: white;
      font-size: 0.55rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .filter-nav {
      display: flex;
      gap: 0.5rem;
    }

    .filter-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #ccd6f6;
      padding: 0.5rem 1rem;
      border-radius: 25px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-2px);
      }

      &.active {
        background: linear-gradient(135deg, #00d9ff, #00ff88);
        color: #0a0a0f;
        font-weight: 600;
        border-color: transparent;
      }

      .filter-icon {
        font-size: 1rem;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* Exposure Indicator */
    .exposure-indicator {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.35rem 0.75rem; border-radius: 20px;
      background: rgba(0,217,255,0.08); border: 1px solid rgba(0,217,255,0.15);
      &.cb-active { background: rgba(255,152,0,0.12); border-color: rgba(255,152,0,0.3); }
    }
    .exposure-icon { font-size: 1rem; }
    .exposure-count { font-size: 0.72rem; color: #00d9ff; font-weight: 600; }
    .exposure-drift-badge {
      font-size: 0.58rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 6px;
      &.drift-mild-drift { background: rgba(255,235,59,0.15); color: #ffeb3b; }
      &.drift-moderate-drift { background: rgba(255,152,0,0.15); color: #ff9800; }
      &.drift-significant-drift { background: rgba(244,67,54,0.15); color: #f44336; }
    }

    .legend {
      display: flex;
      gap: 1rem;
      font-size: 0.75rem;
      color: #8892b0;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.625rem;
      font-weight: 700;
    }

    .ai-badge {
      background: linear-gradient(135deg, #e91e63, #9c27b0);
      color: white;
    }

    .human-badge {
      background: linear-gradient(135deg, #4caf50, #8bc34a);
      color: white;
    }

    .bias-badge {
      background: linear-gradient(135deg, #ff9800, #ff6d00);
      color: white;
    }

    .dashboard-link {
      position: relative;
    }

    .survey-link {
      position: relative;
      &.active { background: linear-gradient(135deg, #9c27b0, #e91e63); }
    }

    @media (max-width: 768px) {
      .header {
        padding: 1rem;
      }

      .header-content {
        flex-direction: column;
        align-items: stretch;
      }

      .logo .tagline {
        display: none;
      }

      .filter-nav {
        overflow-x: auto;
        padding-bottom: 0.5rem;
      }

      .main-nav {
        width: 100%;
        justify-content: center;
      }

      .legend {
        justify-content: center;
      }
    }
  `]
})
export class HeaderComponent {
  private postService = inject(PostService);
  private router = inject(Router);
  exposureTracker = inject(ExposureTrackerService);
  showAiInfluence = signal(true);

  filters: { value: ContentType; label: string; icon: string }[] = [
    { value: 'all', label: 'All Posts', icon: '📋' },
    { value: 'ai-generated', label: 'AI Generated', icon: '🤖' },
    { value: 'human-created', label: 'Human Created', icon: '👤' },
    { value: 'disputed', label: 'Disputed', icon: '⚠️' },
    { value: 'bias-flagged', label: 'Bias Flagged', icon: '🚩' },
    { value: 'debiased-safe', label: 'Debiased Safe', icon: '✅' },
    { value: 'high-region-dominance', label: 'High Dominance', icon: '🌍' },
    { value: 'nonbias-baseline', label: 'Baseline View', icon: '📏' },
  ];

  get currentFilter(): ContentType {
    return this.postService.getFilter();
  }

  setFilter(filter: ContentType): void {
    this.postService.setFilter(filter);
  }

  isOnFeedPage(): boolean {
    return this.router.url === '/' || this.router.url === '';
  }
}

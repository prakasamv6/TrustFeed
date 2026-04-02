import { Component, inject, signal, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { PostService } from '../../services/post.service';
import { ExposureTrackerService } from '../../services/exposure-tracker.service';
import { AccessibilityService } from '../../services/accessibility.service';
import { ContentType } from '../../models/post.model';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <header class="header glass" role="banner">
      <!-- AI Analysis Active — dismissible info banner -->
      @if (showAiInfluence()) {
        <div class="info-banner" role="status" aria-live="polite">
          <div class="info-banner-inner">
            <div class="info-banner-left">
              <span class="pulse-dot" aria-hidden="true"></span>
              <app-icon name="brain" [size]="16" color="var(--accent-blue)" />
              <p class="info-banner-text">
                <strong>AI Analysis Active</strong> — 5 regional bias agents + 1 baseline are analyzing content. All AI suggestions are clearly labeled.
              </p>
            </div>
            <div class="info-banner-right">
              <span class="info-badge" [attr.aria-label]="exposureTracker.aiExposureCount() + ' items analyzed'">
                {{ exposureTracker.aiExposureCount() }} analyzed
              </span>
              <button
                class="info-dismiss"
                (click)="showAiInfluence.set(false)"
                aria-label="Dismiss notification"
              >
                <app-icon name="x-close" [size]="14" />
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Disclaimer Bar -->
      <div class="disclaimer-bar" role="alert">
        <app-icon name="warning" [size]="14" />
        <span>BIAS SIMULATOR — AI-Influenced Suggestions Are Clearly Marked</span>
      </div>

      <!-- Main Header Content -->
      <div class="header-main">
        <div class="header-top-row">
          <!-- Brand -->
          <a routerLink="/" class="brand" aria-label="TrustFeed home">
            <div class="brand-logo" aria-hidden="true">
              <app-icon name="shield" [size]="24" color="white" />
            </div>
            <div class="brand-text">
              <h1 class="brand-name">TrustFeed</h1>
              <span class="brand-tagline">Authentic Content, Transparent AI</span>
            </div>
            <span class="version-badge">v2.0</span>
            <span class="live-indicator">
              <span class="live-dot" aria-hidden="true"></span>
              LIVE
            </span>
          </a>

          <!-- Main Navigation -->
          <nav class="main-nav" aria-label="Main navigation">
            <ul class="nav-list" role="list">
              <li>
                <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item" [attr.aria-current]="isOnFeedPage() ? 'page' : null">
                  <app-icon name="activity" [size]="18" />
                  <span>Feed</span>
                </a>
              </li>
              <li>
                <a routerLink="/review" routerLinkActive="active" class="nav-item" [attr.aria-current]="router.url === '/review' ? 'page' : null">
                  <app-icon name="text" [size]="18" />
                  <span>Content Review</span>
                </a>
              </li>
              <li>
                <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" [attr.aria-current]="router.url === '/dashboard' ? 'page' : null">
                  <app-icon name="chart" [size]="18" />
                  <span>Bias Dashboard</span>
                </a>
              </li>
              <li>
                <a routerLink="/trending" routerLinkActive="active" class="nav-item" [attr.aria-current]="router.url === '/trending' ? 'page' : null">
                  <app-icon name="activity" [size]="18" />
                  <span>Trending</span>
                  <span class="new-pill" aria-label="New feature">NEW</span>
                </a>
              </li>
              <li>
                <a routerLink="/survey" routerLinkActive="active" class="nav-item survey-item" [attr.aria-current]="router.url === '/survey' ? 'page' : null">
                  <app-icon name="clipboard" [size]="18" />
                  <span>Survey</span>
                  <span class="new-pill" aria-label="New feature">NEW</span>
                </a>
              </li>
            </ul>
          </nav>

          <!-- Header Right Actions -->
          <div class="header-actions">
            @if (isOnFeedPage()) {
              <div
                class="exposure-chip"
                [class.triggered]="exposureTracker.circuitBreaker().triggered"
                role="status"
                [attr.aria-label]="'AI exposure: ' + exposureTracker.aiExposureCount() + ' items. Drift: ' + exposureTracker.judgmentDrift().level"
              >
                <app-icon name="zap" [size]="16" />
                <span class="exposure-num">{{ exposureTracker.aiExposureCount() }} AI</span>
                @if (exposureTracker.judgmentDrift().level !== 'stable') {
                  <span class="drift-chip" [class]="'drift-' + exposureTracker.judgmentDrift().level">
                    {{ exposureTracker.judgmentDrift().level }}
                  </span>
                }
              </div>

              <div class="legend" role="list" aria-label="Content type legend">
                <div class="legend-item" role="listitem">
                  <span class="legend-dot ai-dot" aria-hidden="true"></span>
                  <span>AI</span>
                </div>
                <div class="legend-item" role="listitem">
                  <span class="legend-dot human-dot" aria-hidden="true"></span>
                  <span>Human</span>
                </div>
                <div class="legend-item" role="listitem">
                  <span class="legend-dot bias-dot" aria-hidden="true"></span>
                  <span>Bias Flagged</span>
                </div>
              </div>
            }

            <!-- Toolbar buttons -->
            <div class="toolbar" role="toolbar" aria-label="Quick actions">
              <button class="toolbar-btn" (click)="openCommandPalette.emit()" aria-label="Open command palette (Ctrl+K)" title="Command Palette (Ctrl+K)">
                <app-icon name="command" [size]="18" />
              </button>
              <button class="toolbar-btn" (click)="openTransparency.emit()" aria-label="Open transparency panel" title="Transparency">
                <app-icon name="transparency" [size]="18" />
              </button>
              <button class="toolbar-btn" (click)="openSettings.emit()" aria-label="Open settings" title="Settings">
                <app-icon name="settings" [size]="18" />
              </button>
              <button class="toolbar-btn" (click)="toggleTheme()" [attr.aria-label]="a11y.effectiveTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" [title]="a11y.effectiveTheme() === 'dark' ? 'Light mode' : 'Dark mode'">
                <app-icon [name]="a11y.effectiveTheme() === 'dark' ? 'sun' : 'moon'" [size]="18" />
              </button>
            </div>
          </div>
        </div>

        <!-- Filter Bar (Feed page) -->
        @if (isOnFeedPage()) {
          <nav class="filter-bar" aria-label="Content filters">
            <div class="filter-scroll" role="radiogroup" aria-label="Filter posts by type">
              @for (filter of filters; track filter.value) {
                <button
                  [class.active]="currentFilter === filter.value"
                  (click)="setFilter(filter.value)"
                  class="filter-chip"
                  role="radio"
                  [attr.aria-checked]="currentFilter === filter.value"
                  [attr.aria-label]="'Filter: ' + filter.label"
                >
                  <app-icon [name]="filter.icon" [size]="14" />
                  <span>{{ filter.label }}</span>
                </button>
              }
            </div>
          </nav>
        }
      </div>
    </header>
  `,
  styles: [`
    .header {
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      border-bottom: 1px solid var(--border-default);
      backdrop-filter: blur(var(--blur-md));
      -webkit-backdrop-filter: blur(var(--blur-md));
      background: var(--bg-glass);
    }

    /* ── Info Banner ── */
    .info-banner {
      background: var(--info-bg);
      border-bottom: 1px solid rgba(88, 166, 255, 0.15);
      padding: var(--space-2) var(--space-6);
      animation: fadeInUp 0.3s ease-out;
    }
    .info-banner-inner {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }
    .info-banner-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }
    .pulse-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--accent-blue);
      flex-shrink: 0;
      animation: pulse 2s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(88, 166, 255, 0.5);
    }
    .info-banner-text {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      line-height: 1.4;
      strong { color: var(--accent-blue); }
    }
    .info-banner-right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-shrink: 0;
    }
    .info-badge {
      font-size: 0.65rem;
      font-weight: 600;
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent-blue);
      white-space: nowrap;
    }
    .info-dismiss {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px; height: 28px;
      border-radius: 50%;
      border: 1px solid var(--border-default);
      color: var(--text-muted);
      transition: all var(--transition-fast);
      &:hover { background: var(--bg-hover); color: var(--text-primary); }
    }

    /* ── Disclaimer ── */
    .disclaimer-bar {
      background: var(--warning-bg);
      border-bottom: 1px solid rgba(210, 153, 34, 0.2);
      color: var(--warning-color);
      text-align: center;
      padding: var(--space-2) var(--space-4);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
    }

    /* ── Header Main ── */
    .header-main {
      max-width: 1400px;
      margin: 0 auto;
      padding: var(--space-3) var(--space-6);
    }
    .header-top-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    /* ── Brand ── */
    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      text-decoration: none !important;
      flex-shrink: 0;
      min-width: 0;
    }
    .brand-logo {
      width: 36px; height: 36px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 12px rgba(88, 166, 255, 0.2);
      flex-shrink: 0;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .brand-name {
      font-size: var(--text-lg);
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }
    .brand-tagline {
      font-size: 0.6rem;
      color: var(--text-muted);
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .version-badge {
      font-size: 0.55rem;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--bg-elevated);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: 0.55rem;
      font-weight: 700;
      color: var(--accent-green);
      background: var(--human-bg);
      border: 1px solid rgba(63, 185, 80, 0.25);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .live-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--accent-green);
      animation: pulse 1.5s ease-in-out infinite;
    }

    /* ── Main Nav ── */
    .main-nav {
      display: flex;
      flex: 1 1 auto;
      justify-content: center;
      min-width: 0;
    }
    .nav-list {
      display: flex;
      gap: 2px;
      list-style: none;
      margin: 0;
      padding: var(--space-1);
      background: var(--bg-elevated);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      text-decoration: none !important;
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-weight: 500;
      transition: all var(--transition-fast);
      position: relative;
      white-space: nowrap;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
      &.active {
        background: var(--info-bg);
        color: var(--accent-blue);
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }
    .survey-item {
      &.active {
        background: rgba(188, 140, 255, 0.12);
        color: var(--accent-purple);
      }
    }
    .new-pill {
      font-size: 0.5rem;
      font-weight: 700;
      color: white;
      background: var(--accent-red);
      padding: 1px 5px;
      border-radius: var(--radius-full);
      letter-spacing: 0.5px;
      line-height: 1.3;
    }

    /* ── Header Actions ── */
    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-shrink: 0;
    }
    .exposure-chip {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      font-size: 0.7rem;
      color: var(--accent-cyan);
      white-space: nowrap;
      &.triggered {
        background: var(--warning-bg);
        border-color: rgba(210, 153, 34, 0.3);
        color: var(--warning-color);
      }
    }
    .exposure-num { font-weight: 600; }
    .drift-chip {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: var(--radius-sm);
      &.drift-mild-drift { background: rgba(210, 153, 34, 0.15); color: var(--accent-orange); }
      &.drift-moderate-drift { background: rgba(210, 153, 34, 0.2); color: var(--accent-orange); }
      &.drift-significant-drift { background: var(--danger-bg); color: var(--accent-red); }
    }

    .legend {
      display: flex;
      gap: var(--space-3);
      font-size: 0.7rem;
      color: var(--text-muted);
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .legend-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .ai-dot { background: var(--ai-color); }
    .human-dot { background: var(--accent-green); }
    .bias-dot { background: var(--accent-orange); }

    /* ── Toolbar ── */
    .toolbar {
      display: flex;
      gap: 1px;
      padding: 3px;
      border-radius: var(--radius-lg);
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
    }
    .toolbar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
      &:focus-visible {
        outline: 2px solid var(--focus-color);
        outline-offset: 1px;
      }
    }

    /* ── Filter Bar ── */
    .filter-bar {
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-subtle);
    }
    .filter-scroll {
      display: flex;
      gap: var(--space-2);
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      &::-webkit-scrollbar { display: none; }
    }
    .filter-chip {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      font-size: var(--text-xs);
      font-weight: 500;
      white-space: nowrap;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: rgba(240, 246, 252, 0.2);
      }
      &.active {
        background: var(--info-bg);
        color: var(--accent-blue);
        border-color: rgba(88, 166, 255, 0.3);
        font-weight: 600;
      }
    }

    /* ── Responsive ── */
    @media (max-width: 1200px) {
      .nav-item { padding: var(--space-2); font-size: 0.75rem; }
      .nav-item span { display: none; }
      .brand-tagline { display: none; }
    }

    @media (max-width: 1024px) {
      .legend { display: none; }
      .exposure-chip .drift-chip { display: none; }
    }

    @media (max-width: 768px) {
      .header-main { padding: var(--space-2) var(--space-3); }
      .header-top-row { flex-wrap: wrap; gap: var(--space-2); }
      .main-nav { order: 3; width: 100%; overflow-x: auto; }
      .nav-list {
        width: 100%;
        justify-content: space-around;
        background: transparent;
        border: none;
        padding: 0;
      }
      .nav-item { flex: 1; justify-content: center; }
      .nav-item span { display: none; }
      .version-badge, .live-indicator { display: none; }
      .exposure-chip { font-size: 0.6rem; }
      .toolbar-btn { width: 28px; height: 28px; }
      .filter-bar { margin-top: var(--space-2); padding-top: var(--space-2); }
      .filter-chip { font-size: 0.65rem; padding: var(--space-1) var(--space-2); }
    }

    @media (max-width: 480px) {
      .brand-text { display: none; }
      .new-pill { display: none; }
      .toolbar { gap: 0; }
    }

    @media (forced-colors: active) {
      .header { border-bottom: 2px solid ButtonText; }
      .nav-item.active { outline: 2px solid Highlight; }
      .filter-chip.active { outline: 2px solid Highlight; }
    }
  `]
})
export class HeaderComponent {
  private postService = inject(PostService);
  router = inject(Router);
  exposureTracker = inject(ExposureTrackerService);
  a11y = inject(AccessibilityService);

  openSettings = output();
  openTransparency = output();
  openCommandPalette = output();

  showAiInfluence = signal(true);

  filters: { value: ContentType; label: string; icon: IconName }[] = [
    { value: 'all', label: 'All Posts', icon: 'layout' },
    { value: 'ai-generated', label: 'AI Generated', icon: 'ai-robot' },
    { value: 'human-created', label: 'Human Created', icon: 'human' },
    { value: 'disputed', label: 'Disputed', icon: 'warning' },
    { value: 'bias-flagged', label: 'Bias Flagged', icon: 'flag' },
    { value: 'debiased-safe', label: 'Debiased Safe', icon: 'verified' },
    { value: 'high-region-dominance', label: 'High Dominance', icon: 'globe' },
    { value: 'nonbias-baseline', label: 'Baseline View', icon: 'target' },
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

  toggleTheme(): void {
    const current = this.a11y.effectiveTheme();
    this.a11y.setTheme(current === 'dark' ? 'light' : 'dark');
  }
}

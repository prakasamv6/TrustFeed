import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PostService } from '../../services/post.service';
import { ExposureTrackerService } from '../../services/exposure-tracker.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { CreatePostComponent } from '../create-post/create-post.component';
import { SortMode } from '../../models/post.model';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [DecimalPipe, PostCardComponent, CreatePostComponent],
  template: `
    @let cb = exposureTracker.circuitBreaker();
    @let drift = exposureTracker.judgmentDrift();
    @let aiCount = exposureTracker.aiExposureCount();

    <!-- Circuit Breaker Interstitial Overlay -->
    @if (cb.cooldownActive) {
    <div
      class="cb-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cb-title"
      aria-describedby="cb-desc"
    >
      <div class="cb-modal">
        <div class="cb-icon-wrap" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <h2 id="cb-title" class="cb-title">Circuit Breaker Activated</h2>
        <p id="cb-desc" class="cb-desc">{{ cb.reason }}</p>
        <div class="cb-metrics" role="group" aria-label="Exposure metrics">
          <div class="cb-metric">
            <span class="cb-metric-val">{{ cb.exposureCount }}</span>
            <span class="cb-metric-label">AI Exposures</span>
          </div>
          <div class="cb-metric">
            <span class="cb-metric-val">{{ cb.diversityScore * 100 | number:'1.0-0' }}%</span>
            <span class="cb-metric-label">Diversity Score</span>
          </div>
          <div class="cb-metric">
            <span class="cb-metric-val">{{ drift.level }}</span>
            <span class="cb-metric-label">Drift Level</span>
          </div>
        </div>
        <p class="cb-advice">Consider browsing human-created content or taking a short break to recalibrate.</p>
        <button class="cb-btn" (click)="exposureTracker.acknowledgeCooldown()">
          I Understand — Continue Browsing
        </button>
      </div>
    </div>
    }

    <div class="feed-layout">
      <!-- Left Sidebar -->
      <aside class="sidebar sidebar-left" aria-label="About TrustFeed">
        <div class="card">
          <div class="card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <h2 class="card-title">About TrustFeed</h2>
          </div>
          <p class="card-text">
            TrustFeed is a proof-of-concept social platform that promotes transparency
            about AI-generated content. Authors can declare if their content is AI-generated,
            and the community can provide feedback.
          </p>
        </div>

        <div class="card">
          <div class="card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <h2 class="card-title">How It Works</h2>
          </div>
          <ul class="feature-list" role="list">
            <li role="listitem">
              <span class="feature-bullet" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span>Authors toggle AI declaration when posting</span>
            </li>
            <li role="listitem">
              <span class="feature-bullet" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span>Community votes on content authenticity</span>
            </li>
            <li role="listitem">
              <span class="feature-bullet" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span>Confidence levels show consensus</span>
            </li>
            <li role="listitem">
              <span class="feature-bullet" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span>Disputed content is flagged for review</span>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Main Feed -->
      <main class="feed-main" role="main" aria-label="Content feed">
        <app-create-post />

        <section class="posts-section" aria-label="Posts">
          <div class="section-bar">
            <h2 class="section-title">{{ getSectionTitle() }}</h2>
            <div class="section-controls">
              <label for="sort-select" class="sr-only">Sort posts by</label>
              <select id="sort-select" class="sort-select" [value]="currentSort" (change)="onSortChange($event)">
                @for (s of sortOptions; track s.value) {
                <option [value]="s.value">{{ s.label }}</option>
                }
              </select>
              <span class="post-count" aria-live="polite">{{ posts().length }} posts</span>
            </div>
          </div>

          @if (posts().length === 0) {
          <div class="empty-state" role="status">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5"/><line x1="9" y1="10" x2="9.01" y2="10"/>
              <line x1="15" y1="10" x2="15.01" y2="10"/><path d="M8 15s1.5-2 4-2 4 2 4 2"/>
            </svg>
            <h3>No posts found</h3>
            <p>Try changing your filter or create a new post!</p>
          </div>
          }

          @for (post of posts(); track post.id) {
          <app-post-card
            [post]="post"
          />
          }
        </section>
      </main>

      <!-- Right Sidebar -->
      <aside class="sidebar sidebar-right" aria-label="Monitoring and stats">
        <!-- Exposure Monitor -->
        <div class="card card-exposure" role="region" aria-label="Exposure Monitor">
          <div class="card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" aria-hidden="true">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <h2 class="card-title">Exposure Monitor</h2>
          </div>
          <div class="monitor-stats">
            <div class="monitor-row">
              <span class="monitor-label">AI Exposures</span>
              <span class="monitor-value" [class.warning]="aiCount >= 7"
                    [attr.aria-label]="aiCount + ' of ' + cb.exposureCap + ' AI exposures'">
                {{ aiCount }} / {{ cb.exposureCap }}
              </span>
            </div>
            <div class="progress-bar" role="progressbar"
                 [attr.aria-valuenow]="aiCount"
                 [attr.aria-valuemax]="cb.exposureCap"
                 aria-label="AI exposure progress">
              <div class="progress-fill"
                [style.width.%]="(aiCount / cb.exposureCap) * 100"
                [class.warning]="aiCount >= 7"
                [class.danger]="aiCount >= 10"></div>
            </div>
            <div class="monitor-row">
              <span class="monitor-label">Diversity Score</span>
              <span class="monitor-value" [class.warning]="cb.diversityScore < 0.4">
                {{ cb.diversityScore * 100 | number:'1.0-0' }}%
              </span>
            </div>
            <div class="monitor-row monitor-drift">
              <span class="monitor-label">Judgment Drift</span>
              <span class="drift-badge" [class]="'drift-' + drift.level">
                {{ drift.level }}
              </span>
            </div>
            @if (drift.level !== 'stable') {
            <div class="drift-details">
              <div class="drift-row">
                <span>Accuracy Shift</span>
                <span [class.positive]="drift.accuracyShift > 0"
                      [class.negative]="drift.accuracyShift < 0">
                  {{ drift.accuracyShift > 0 ? '+' : '' }}{{ drift.accuracyShift * 100 | number:'1.0-0' }}%
                </span>
              </div>
              <div class="drift-row">
                <span>AI Suspicion</span>
                <span>{{ drift.aiSuspicionTrend * 100 | number:'1.0-0' }}%</span>
              </div>
              <div class="drift-row">
                <span>Consecutive AI</span>
                <span>{{ drift.consecutiveAiExposures }}</span>
              </div>
            </div>
            }
          </div>
          @if (cb.triggered) {
          <div class="cb-active-indicator" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span>Circuit breaker active</span>
          </div>
          }
        </div>

        <!-- Platform Stats -->
        <div class="card" role="region" aria-label="Platform statistics">
          <div class="card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <h2 class="card-title">Platform Stats</h2>
          </div>
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-num ai-num">{{ getAiDeclaredCount() }}</span>
              <span class="stat-desc">AI-Declared</span>
            </div>
            <div class="stat-card">
              <span class="stat-num human-num">{{ getHumanCount() }}</span>
              <span class="stat-desc">Human Posts</span>
            </div>
            <div class="stat-card">
              <span class="stat-num warn-num">{{ getDisputedCount() }}</span>
              <span class="stat-desc">Disputed</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ getTotalVotes() }}</span>
              <span class="stat-desc">Total Votes</span>
            </div>
          </div>
        </div>

        <!-- Why This Matters -->
        <div class="card" role="region" aria-label="Why this matters">
          <div class="card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <h2 class="card-title">Why This Matters</h2>
          </div>
          <div class="info-list">
            <div class="info-item">
              <div class="info-icon-wrap shield" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <h3 class="info-name">Combat Misinformation</h3>
                <p class="info-desc">Transparency about AI content helps users make informed decisions.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon-wrap trust" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div>
                <h3 class="info-name">Build Trust</h3>
                <p class="info-desc">Community verification creates accountability.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon-wrap ethics" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3v18"/><path d="M5.5 6.5l13 11"/><path d="M5.5 17.5l13-11"/>
                </svg>
              </div>
              <div>
                <h3 class="info-name">Ethical AI Use</h3>
                <p class="info-desc">Encourages responsible disclosure of AI assistance.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    /* ── Circuit Breaker Overlay ── */
    .cb-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(8px);
    }
    .cb-modal {
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      padding: var(--space-10);
      max-width: 480px;
      width: 90%;
      text-align: center;
      border: 1px solid rgba(210, 153, 34, 0.3);
      box-shadow: var(--shadow-xl);
    }
    .cb-icon-wrap {
      width: 64px; height: 64px;
      margin: 0 auto var(--space-6);
      border-radius: 50%;
      background: var(--warning-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-orange);
    }
    .cb-title {
      color: var(--accent-orange);
      font-size: var(--text-xl);
      font-weight: 700;
      margin-bottom: var(--space-3);
    }
    .cb-desc {
      color: var(--text-secondary);
      font-size: var(--text-sm);
      line-height: 1.6;
      margin-bottom: var(--space-6);
    }
    .cb-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-6);
    }
    .cb-metric {
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      border: 1px solid var(--border-subtle);
    }
    .cb-metric-val {
      display: block;
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--accent-orange);
    }
    .cb-metric-label {
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    .cb-advice {
      font-size: var(--text-xs);
      color: var(--text-muted);
      margin-bottom: var(--space-6);
    }
    .cb-btn {
      background: var(--accent-orange);
      color: var(--bg-primary);
      border: none;
      padding: var(--space-3) var(--space-8);
      border-radius: var(--radius-full);
      font-size: var(--text-sm);
      font-weight: 600;
      transition: all var(--transition-fast);
      &:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(210, 153, 34, 0.3); }
    }

    /* ── Layout ── */
    .feed-layout {
      display: grid;
      grid-template-columns: 280px 1fr 300px;
      gap: var(--space-6);
      max-width: 1400px;
      margin: 0 auto;
      padding: var(--space-6);
    }

    /* ── Sidebar ── */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      position: sticky;
      top: 120px;
      height: fit-content;
    }

    /* ── Card (shared) ── */
    .card {
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
      border: 1px solid var(--border-default);
      transition: border-color var(--transition-fast);
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .card-title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-primary);
    }
    .card-text {
      font-size: var(--text-xs);
      color: var(--text-muted);
      line-height: 1.7;
    }

    .card-exposure {
      border-color: rgba(57, 210, 192, 0.2);
    }

    /* ── Feature List ── */
    .feature-list {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      li {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        font-size: var(--text-xs);
        color: var(--text-secondary);
        line-height: 1.5;
      }
    }
    .feature-bullet {
      flex-shrink: 0;
      margin-top: 2px;
    }

    /* ── Feed Main ── */
    .feed-main { min-width: 0; }

    .section-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-5);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--border-subtle);
    }
    .section-title {
      font-size: var(--text-lg);
      font-weight: 600;
      color: var(--text-primary);
    }
    .section-controls {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .sort-select {
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      option { background: var(--bg-secondary); color: var(--text-secondary); }
    }
    .post-count {
      font-size: var(--text-xs);
      color: var(--text-muted);
      background: var(--bg-elevated);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
    }

    /* ── Empty State ── */
    .empty-state {
      text-align: center;
      padding: var(--space-12) var(--space-8);
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      border: 1px dashed var(--border-default);
      h3 { margin: var(--space-4) 0 var(--space-2); color: var(--text-primary); font-size: var(--text-base); }
      p { color: var(--text-muted); font-size: var(--text-sm); }
    }

    /* ── Monitor Stats ── */
    .monitor-stats {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .monitor-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .monitor-label { font-size: var(--text-xs); color: var(--text-muted); }
    .monitor-value {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--accent-cyan);
      &.warning { color: var(--accent-orange); }
    }
    .progress-bar {
      height: 6px;
      background: var(--bg-elevated);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--accent-cyan);
      border-radius: 3px;
      transition: width 0.5s ease;
      &.warning { background: var(--accent-orange); }
      &.danger { background: var(--accent-red); }
    }
    .monitor-drift {
      padding-top: var(--space-2);
      border-top: 1px solid var(--border-subtle);
    }
    .drift-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      &.drift-stable { background: var(--human-bg); color: var(--accent-green); }
      &.drift-mild-drift { background: var(--warning-bg); color: var(--accent-orange); }
      &.drift-moderate-drift { background: var(--warning-bg); color: var(--accent-orange); }
      &.drift-significant-drift { background: var(--danger-bg); color: var(--accent-red); }
    }
    .drift-details {
      padding: var(--space-2) var(--space-3);
      background: var(--bg-elevated);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .drift-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      color: var(--text-muted);
      .positive { color: var(--accent-green); }
      .negative { color: var(--accent-red); }
    }
    .cb-active-indicator {
      margin-top: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: var(--warning-bg);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      border: 1px solid rgba(210, 153, 34, 0.2);
      color: var(--accent-orange);
      font-size: var(--text-xs);
      font-weight: 600;
    }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-3);
    }
    .stat-card {
      text-align: center;
      padding: var(--space-4);
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }
    .stat-num {
      display: block;
      font-size: var(--text-2xl);
      font-weight: 700;
      color: var(--accent-blue);
      margin-bottom: var(--space-1);
    }
    .ai-num { color: var(--ai-color); }
    .human-num { color: var(--accent-green); }
    .warn-num { color: var(--accent-orange); }
    .stat-desc {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    /* ── Info List ── */
    .info-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .info-item {
      display: flex;
      gap: var(--space-3);
    }
    .info-icon-wrap {
      width: 36px; height: 36px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      &.shield { background: var(--info-bg); color: var(--accent-blue); }
      &.trust { background: var(--human-bg); color: var(--accent-green); }
      &.ethics { background: rgba(188, 140, 255, 0.12); color: var(--accent-purple); }
    }
    .info-name {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
    }
    .info-desc {
      font-size: 0.68rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    /* ── Responsive ── */
    @media (max-width: 1200px) {
      .feed-layout {
        grid-template-columns: 1fr 300px;
        padding: var(--space-4);
      }
      .sidebar-left { display: none; }
    }
    @media (max-width: 768px) {
      .feed-layout {
        grid-template-columns: 1fr;
        padding: var(--space-3);
      }
      .sidebar { display: none; }
    }
  `]
})
export class FeedComponent {
  private postService = inject(PostService);
  exposureTracker = inject(ExposureTrackerService);

  posts = this.postService.posts;

  sortOptions: { value: SortMode; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'highest-bias-delta', label: 'Highest Bias Delta' },
    { value: 'highest-disagreement', label: 'Highest Disagreement' },
    { value: 'highest-region-dominance', label: 'Region Dominance' },
    { value: 'likely-human', label: 'Likely Human' },
    { value: 'likely-ai', label: 'Likely AI' },
    { value: 'highest-debiased-confidence', label: 'Debiased Confidence' },
  ];

  get currentSort(): SortMode {
    return this.postService.getSort();
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SortMode;
    this.postService.setSort(value);
  }

  trackPost(index: number, post: { id: string }) {
    return post.id;
  }

  getSectionTitle(): string {
    const filter = this.postService.getFilter();
    switch (filter) {
      case 'ai-generated': return 'AI-Generated Posts';
      case 'human-created': return 'Human-Created Posts';
      case 'disputed': return 'Disputed Posts';
      case 'bias-flagged': return 'Bias-Flagged Posts';
      case 'debiased-safe': return 'Debiased-Safe Posts';
      case 'high-region-dominance': return 'High Region Dominance';
      case 'nonbias-baseline': return 'Baseline Posts';
      default: return 'All Posts';
    }
  }

  getAiDeclaredCount(): number {
    return this.posts().filter(p => p.isAiGenerated).length;
  }

  getHumanCount(): number {
    return this.posts().filter(p => !p.isAiGenerated).length;
  }

  getDisputedCount(): number {
    return this.posts().filter(p => {
      const total = p.aiGeneratedFeedback.flaggedAsAi + p.aiGeneratedFeedback.flaggedAsHuman;
      if (total === 0) return false;
      const aiRatio = p.aiGeneratedFeedback.flaggedAsAi / total;
      return aiRatio > 0.3 && aiRatio < 0.7;
    }).length;
  }

  getTotalVotes(): number {
    return this.posts().reduce((sum, p) =>
      sum + p.aiGeneratedFeedback.flaggedAsAi + p.aiGeneratedFeedback.flaggedAsHuman, 0
    );
  }
}

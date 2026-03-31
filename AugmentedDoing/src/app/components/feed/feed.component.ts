import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostService } from '../../services/post.service';
import { ExposureTrackerService } from '../../services/exposure-tracker.service';
import { PostCardComponent } from '../post-card/post-card.component';
import { CreatePostComponent } from '../create-post/create-post.component';
import { SortMode } from '../../models/post.model';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, PostCardComponent, CreatePostComponent],
  template: `
    <!-- Circuit Breaker Interstitial Overlay (proposal §Overview: exposure caps & diversity constraints) -->
    <div class="circuit-breaker-overlay" *ngIf="exposureTracker.circuitBreaker().cooldownActive">
      <div class="cb-interstitial">
        <span class="cb-icon">⚡</span>
        <h2 class="cb-title">Circuit Breaker Activated</h2>
        <p class="cb-reason">{{ exposureTracker.circuitBreaker().reason }}</p>
        <div class="cb-stats">
          <div class="cb-stat">
            <span class="cb-stat-value">{{ exposureTracker.circuitBreaker().exposureCount }}</span>
            <span class="cb-stat-label">AI Exposures</span>
          </div>
          <div class="cb-stat">
            <span class="cb-stat-value">{{ exposureTracker.circuitBreaker().diversityScore * 100 | number:'1.0-0' }}%</span>
            <span class="cb-stat-label">Diversity Score</span>
          </div>
          <div class="cb-stat">
            <span class="cb-stat-value">{{ exposureTracker.judgmentDrift().level }}</span>
            <span class="cb-stat-label">Drift Level</span>
          </div>
        </div>
        <p class="cb-suggestion">Consider browsing human-created content or taking a short break to recalibrate.</p>
        <button class="cb-acknowledge-btn" (click)="exposureTracker.acknowledgeCooldown()">
          I Understand — Continue Browsing
        </button>
      </div>
    </div>

    <div class="feed-container">
      <aside class="sidebar left-sidebar">
        <div class="sidebar-card">
          <h3>🎯 About TrustFeed</h3>
          <p>
            TrustFeed is a proof-of-concept social platform that promotes transparency
            about AI-generated content. Authors can declare if their content is AI-generated,
            and the community can provide feedback.
          </p>
        </div>

        <div class="sidebar-card">
          <h3>📊 How It Works</h3>
          <ul class="feature-list">
            <li>
              <span class="feature-icon">✍️</span>
              <span>Authors toggle AI declaration when posting</span>
            </li>
            <li>
              <span class="feature-icon">🔍</span>
              <span>Community votes on content authenticity</span>
            </li>
            <li>
              <span class="feature-icon">📈</span>
              <span>Confidence levels show consensus</span>
            </li>
            <li>
              <span class="feature-icon">⚠️</span>
              <span>Disputed content is flagged</span>
            </li>
          </ul>
        </div>
      </aside>

      <main class="main-feed">
        <app-create-post />

        <div class="posts-section">
          <div class="section-header">
            <h2>{{ getSectionTitle() }}</h2>
            <div class="header-controls">
              <select class="sort-select" [value]="currentSort" (change)="onSortChange($event)">
                <option *ngFor="let s of sortOptions" [value]="s.value">{{ s.label }}</option>
              </select>
              <span class="post-count">{{ posts().length }} posts</span>
            </div>
          </div>

          <div *ngIf="posts().length === 0" class="empty-state">
            <span class="empty-icon">📭</span>
            <h3>No posts found</h3>
            <p>Try changing your filter or create a new post!</p>
          </div>

          <app-post-card
            *ngFor="let post of posts(); trackBy: trackPost"
            [post]="post"
          />
        </div>
      </main>

      <aside class="sidebar right-sidebar">
        <!-- Exposure Monitoring Panel (proposal §Overview: feedback monitoring via micro-probes) -->
        <div class="sidebar-card exposure-card">
          <h3>🧠 Exposure Monitor</h3>
          <div class="exposure-stats">
            <div class="exposure-stat-row">
              <span class="exposure-stat-label">AI Exposures</span>
              <span class="exposure-stat-value" [class.warning]="exposureTracker.aiExposureCount() >= 7">
                {{ exposureTracker.aiExposureCount() }} / {{ exposureTracker.circuitBreaker().exposureCap }}
              </span>
            </div>
            <div class="exposure-bar">
              <div class="exposure-fill" [style.width.%]="(exposureTracker.aiExposureCount() / exposureTracker.circuitBreaker().exposureCap) * 100"
                [class.warning]="exposureTracker.aiExposureCount() >= 7"
                [class.danger]="exposureTracker.aiExposureCount() >= 10"
              ></div>
            </div>
            <div class="exposure-stat-row">
              <span class="exposure-stat-label">Diversity Score</span>
              <span class="exposure-stat-value" [class.warning]="exposureTracker.circuitBreaker().diversityScore < 0.4">
                {{ exposureTracker.circuitBreaker().diversityScore * 100 | number:'1.0-0' }}%
              </span>
            </div>
            <div class="drift-indicator">
              <span class="drift-label">Judgment Drift</span>
              <span class="drift-level" [class]="'drift-' + exposureTracker.judgmentDrift().level">
                {{ exposureTracker.judgmentDrift().level }}
              </span>
            </div>
            <div class="drift-details" *ngIf="exposureTracker.judgmentDrift().level !== 'stable'">
              <div class="drift-detail-row">
                <span>Accuracy Shift</span>
                <span [class.positive]="exposureTracker.judgmentDrift().accuracyShift > 0"
                      [class.negative]="exposureTracker.judgmentDrift().accuracyShift < 0">
                  {{ exposureTracker.judgmentDrift().accuracyShift > 0 ? '+' : '' }}{{ exposureTracker.judgmentDrift().accuracyShift * 100 | number:'1.0-0' }}%
                </span>
              </div>
              <div class="drift-detail-row">
                <span>AI Suspicion</span>
                <span>{{ exposureTracker.judgmentDrift().aiSuspicionTrend * 100 | number:'1.0-0' }}%</span>
              </div>
              <div class="drift-detail-row">
                <span>Consecutive AI</span>
                <span>{{ exposureTracker.judgmentDrift().consecutiveAiExposures }}</span>
              </div>
            </div>
          </div>
          <div class="cb-status" *ngIf="exposureTracker.circuitBreaker().triggered">
            <span class="cb-status-icon">⚡</span>
            <span class="cb-status-text">Circuit breaker active</span>
          </div>
        </div>

        <div class="sidebar-card stats-card">
          <h3>📈 Platform Stats</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ getAiDeclaredCount() }}</span>
              <span class="stat-label">AI-Declared Posts</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ getHumanCount() }}</span>
              <span class="stat-label">Human Posts</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ getDisputedCount() }}</span>
              <span class="stat-label">Disputed</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ getTotalVotes() }}</span>
              <span class="stat-label">Total Votes</span>
            </div>
          </div>
        </div>

        <div class="sidebar-card">
          <h3>💡 Why This Matters</h3>
          <div class="info-blocks">
            <div class="info-block">
              <span class="info-icon">🛡️</span>
              <div>
                <h4>Combat Misinformation</h4>
                <p>Transparency about AI content helps users make informed decisions.</p>
              </div>
            </div>
            <div class="info-block">
              <span class="info-icon">🤝</span>
              <div>
                <h4>Build Trust</h4>
                <p>Community verification creates accountability.</p>
              </div>
            </div>
            <div class="info-block">
              <span class="info-icon">⚖️</span>
              <div>
                <h4>Ethical AI Use</h4>
                <p>Encourages responsible disclosure of AI assistance.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    /* Circuit Breaker Overlay */
    .circuit-breaker-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px);
    }
    .cb-interstitial {
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 20px; padding: 2.5rem; max-width: 500px; width: 90%;
      text-align: center; border: 1px solid rgba(255,152,0,0.3);
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .cb-icon { font-size: 3rem; display: block; margin-bottom: 1rem; }
    .cb-title { margin: 0 0 0.75rem; color: #ff9800; font-size: 1.5rem; }
    .cb-reason { color: #ccd6f6; font-size: 0.9rem; line-height: 1.6; margin: 0 0 1.5rem; }
    .cb-stats {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;
    }
    .cb-stat {
      background: rgba(255,255,255,0.03); border-radius: 12px; padding: 0.75rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .cb-stat-value { display: block; font-size: 1.25rem; font-weight: 700; color: #ff9800; }
    .cb-stat-label { font-size: 0.65rem; color: #8892b0; }
    .cb-suggestion { font-size: 0.8rem; color: #8892b0; margin: 0 0 1.5rem; }
    .cb-acknowledge-btn {
      background: linear-gradient(135deg, #ff9800, #ff6d00); color: white;
      border: none; padding: 0.75rem 2rem; border-radius: 25px; cursor: pointer;
      font-size: 0.9rem; font-weight: 600; transition: all 0.3s;
      &:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,152,0,0.3); }
    }

    /* Exposure Monitor Sidebar Card */
    .exposure-card {
      border: 1px solid rgba(0,217,255,0.15) !important;
    }
    .exposure-stats { display: flex; flex-direction: column; gap: 0.6rem; }
    .exposure-stat-row {
      display: flex; justify-content: space-between; align-items: center;
    }
    .exposure-stat-label { font-size: 0.75rem; color: #8892b0; }
    .exposure-stat-value {
      font-size: 0.85rem; font-weight: 600; color: #00d9ff;
      &.warning { color: #ff9800; }
    }
    .exposure-bar {
      height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;
    }
    .exposure-fill {
      height: 100%; background: #00d9ff; border-radius: 3px; transition: width 0.5s;
      &.warning { background: #ff9800; }
      &.danger { background: #f44336; }
    }
    .drift-indicator {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.05);
    }
    .drift-label { font-size: 0.75rem; color: #8892b0; }
    .drift-level {
      font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 8px;
      &.drift-stable { background: rgba(76,175,80,0.15); color: #4caf50; }
      &.drift-mild-drift { background: rgba(255,235,59,0.15); color: #ffeb3b; }
      &.drift-moderate-drift { background: rgba(255,152,0,0.15); color: #ff9800; }
      &.drift-significant-drift { background: rgba(244,67,54,0.15); color: #f44336; }
    }
    .drift-details {
      padding: 0.4rem 0.5rem; background: rgba(255,255,255,0.02);
      border-radius: 8px; display: flex; flex-direction: column; gap: 0.3rem;
    }
    .drift-detail-row {
      display: flex; justify-content: space-between; font-size: 0.68rem; color: #8892b0;
      .positive { color: #4caf50; }
      .negative { color: #f44336; }
    }
    .cb-status {
      margin-top: 0.75rem; padding: 0.5rem; background: rgba(255,152,0,0.1);
      border-radius: 8px; display: flex; align-items: center; gap: 0.4rem;
      border: 1px solid rgba(255,152,0,0.2);
    }
    .cb-status-icon { font-size: 0.9rem; }
    .cb-status-text { font-size: 0.7rem; color: #ff9800; font-weight: 600; }

    .feed-container {
      display: grid;
      grid-template-columns: 280px 1fr 300px;
      gap: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      position: sticky;
      top: 100px;
      height: fit-content;
    }

    .sidebar-card {
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 16px;
      padding: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.05);

      h3 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #e6e6e6;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 0.875rem;
        color: #8892b0;
        line-height: 1.6;
      }
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      li {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        font-size: 0.8rem;
        color: #ccd6f6;
        line-height: 1.4;
      }

      .feature-icon {
        font-size: 1rem;
        flex-shrink: 0;
      }
    }

    .main-feed {
      min-width: 0;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);

      h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #e6e6e6;
      }

      .header-controls {
        display: flex; align-items: center; gap: 0.75rem;
      }

      .post-count {
        font-size: 0.875rem;
        color: #8892b0;
        background: rgba(255, 255, 255, 0.05);
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
      }
    }

    .sort-select {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      color: #ccd6f6; padding: 0.4rem 0.75rem; border-radius: 8px; font-size: 0.8rem;
      cursor: pointer;
      option { background: #1e1e2e; color: #ccd6f6; }
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 16px;
      border: 1px dashed rgba(255, 255, 255, 0.1);

      .empty-icon {
        font-size: 4rem;
        display: block;
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0 0 0.5rem;
        color: #e6e6e6;
      }

      p {
        margin: 0;
        color: #8892b0;
      }
    }

    .stats-card {
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .stat-item {
        text-align: center;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: #00d9ff;
        margin-bottom: 0.25rem;
      }

      .stat-label {
        font-size: 0.7rem;
        color: #8892b0;
      }
    }

    .info-blocks {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .info-block {
      display: flex;
      gap: 0.75rem;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;

      .info-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      h4 {
        margin: 0 0 0.25rem;
        font-size: 0.875rem;
        color: #e6e6e6;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 0.75rem;
        color: #8892b0;
        line-height: 1.4;
      }
    }

    @media (max-width: 1200px) {
      .feed-container {
        grid-template-columns: 1fr;
        padding: 1rem;
      }

      .sidebar {
        display: none;
      }

      .left-sidebar, .right-sidebar {
        position: static;
      }
    }

    @media (max-width: 1200px) and (min-width: 769px) {
      .feed-container {
        grid-template-columns: 1fr 300px;
      }

      .left-sidebar {
        display: none;
      }

      .right-sidebar {
        display: flex;
      }
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
      case 'ai-generated': return '🤖 AI-Generated Posts';
      case 'human-created': return '👤 Human-Created Posts';
      case 'disputed': return '⚠️ Disputed Posts';
      case 'bias-flagged': return '⚠️ Bias-Flagged Posts';
      case 'debiased-safe': return '✅ Debiased-Safe Posts';
      case 'high-region-dominance': return '🌍 High Region Dominance';
      case 'nonbias-baseline': return '📏 Baseline Posts';
      default: return '📋 All Posts';
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

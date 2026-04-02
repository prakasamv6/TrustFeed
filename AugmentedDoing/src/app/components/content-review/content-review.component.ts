import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContentReviewService, ReviewSubmission } from '../../services/content-review.service';

@Component({
  selector: 'app-content-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="review-page">
      <div class="feed-container">
        <!-- Left Sidebar -->
        <aside class="sidebar left-sidebar">
          <div class="sidebar-card">
            <h3>🔍 Content Review</h3>
            <p>
              Paste text from LinkedIn, news articles, or social media to get community 
              feedback on whether it's AI-generated or human-written.
            </p>
          </div>

          <div class="sidebar-card">
            <h3>🎯 AI Indicators</h3>
            <ul class="indicator-list ai-list">
              <li><span>⚠️</span> Generic, polished language</li>
              <li><span>⚠️</span> Excessive buzzwords/hashtags</li>
              <li><span>⚠️</span> Engagement bait phrases</li>
              <li><span>⚠️</span> Formulaic structure</li>
              <li><span>⚠️</span> Vague, unverifiable claims</li>
            </ul>
          </div>

          <div class="sidebar-card">
            <h3>✅ Human Indicators</h3>
            <ul class="indicator-list human-list">
              <li><span>👤</span> Personal anecdotes</li>
              <li><span>👤</span> Authentic emotions</li>
              <li><span>👤</span> Writing quirks</li>
              <li><span>👤</span> Specific details</li>
              <li><span>👤</span> Unpredictable flow</li>
            </ul>
          </div>
        </aside>

        <!-- Main Feed -->
        <main class="main-feed">
          <!-- Submit Card (like Create Post) -->
          <div class="submit-card">
            <div class="submit-header">
              <span class="submit-icon">📋</span>
              <div class="submit-info">
                <span class="submit-title">Submit Content for Review</span>
                <span class="submit-subtitle">Paste suspicious content for community analysis</span>
              </div>
            </div>

            <div class="submit-body">
              <textarea
                [(ngModel)]="contentText"
                placeholder="Paste the LinkedIn post, news article, or social media content you want the community to analyze..."
                class="content-input"
                rows="4"
              ></textarea>

              <div class="source-section">
                <label class="source-label">Source:</label>
                <div class="source-buttons">
                  <button 
                    *ngFor="let src of sources"
                    [class.active]="selectedSource() === src.value"
                    (click)="selectedSource.set(src.value)"
                    class="source-btn"
                  >
                    <span>{{ src.icon }}</span>
                    {{ src.label }}
                  </button>
                </div>
              </div>

              <input
                type="url"
                [(ngModel)]="sourceUrl"
                placeholder="Source URL (optional) - https://..."
                class="url-input"
              />

              <!-- AI Declaration Toggle -->
              <div class="ai-declaration">
                <label class="declaration-toggle" [class.active]="declareAsAi()">
                  <input 
                    type="checkbox" 
                    [checked]="declareAsAi()"
                    (change)="declareAsAi.set(!declareAsAi())"
                  />
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                  <span class="toggle-label">
                    <span class="toggle-icon">🤖</span>
                    Mark as AI-Generated Content
                  </span>
                </label>
                <span class="declaration-hint">Check this if you know this content was created by AI</span>
              </div>
            </div>

            <div class="submit-footer">
              <div class="char-info">
                <span class="char-count">{{ contentText.length }} characters</span>
                <span *ngIf="declareAsAi()" class="ai-badge-small">🤖 Will be marked as AI</span>
              </div>
              <button 
                class="submit-btn"
                [disabled]="!contentText.trim() || contentText.length < 20"
                (click)="submitForReview()"
              >
                <span>🔍</span>
                Submit for Review
              </button>
            </div>
          </div>

          <!-- Section Header -->
          <div class="section-header">
            <h2>📋 Community Reviews</h2>
            <span class="post-count">{{ submissions().length }} submissions</span>
          </div>

          <!-- Submissions Feed -->
          <article 
            *ngFor="let submission of submissions()" 
            class="review-card"
            [class.high-ai]="getConfidence(submission).percentage >= 70"
            [class.high-human]="getConfidence(submission).percentage < 30"
            [class.declared-ai]="submission.declaredAsAi"
          >
            <!-- AI Declaration Banner -->
            <div class="ai-declared-banner" *ngIf="submission.declaredAsAi">
              <span class="declared-icon">🤖</span>
              <span class="declared-text">Declared as AI-Generated</span>
              <span class="declared-time" *ngIf="submission.declaredAt">{{ getTimeAgo(submission.declaredAt) }}</span>
            </div>

            <!-- Status Banner -->
            <div 
              class="status-banner"
              [style.background]="getBannerGradient(submission)"
            >
              <span class="status-icon">{{ getConfidence(submission).percentage >= 50 ? '🤖' : '👤' }}</span>
              <span class="status-text">{{ getConfidence(submission).level }}</span>
              <span class="confidence-percent">{{ getConfidencePercent(submission) }}% confidence</span>
            </div>

            <!-- Card Header -->
            <header class="card-header">
              <div class="source-info">
                <div class="source-badge" [class]="submission.source">
                  {{ getSourceIcon(submission.source) }}
                </div>
                <div class="meta-info">
                  <span class="source-name">{{ getSourceLabel(submission.source) }} Content</span>
                  <span class="time-info">Submitted {{ getTimeAgo(submission.submittedAt) }} by {{ submission.submittedBy }}</span>
                </div>
              </div>
              <div class="header-actions">
                <button 
                  class="declare-btn"
                  [class.active]="submission.declaredAsAi"
                  (click)="toggleAiDeclaration(submission.id)"
                  [title]="submission.declaredAsAi ? 'Remove AI declaration' : 'Mark as AI-generated'"
                >
                  <span>🤖</span>
                  {{ submission.declaredAsAi ? 'Declared AI' : 'Mark as AI' }}
                </button>
                <a *ngIf="submission.sourceUrl" [href]="submission.sourceUrl" target="_blank" class="source-link">
                  🔗 View Original
                </a>
              </div>
            </header>

            <!-- Content -->
            <div class="card-content">
              <p class="content-text">{{ submission.content }}</p>
            </div>

            <!-- AI Analysis Section - Compact Single Line -->
            <div class="analysis-section">
              <!-- Main Metrics Bar -->
              <div class="metrics-bar">
                <div class="metric-item">
                  <div class="metric-ring" [class.high]="submission.analysis.aiInfluenceScore >= 70" [class.medium]="submission.analysis.aiInfluenceScore >= 40 && submission.analysis.aiInfluenceScore < 70" [class.low]="submission.analysis.aiInfluenceScore < 40">
                    <svg viewBox="0 0 36 36" class="circular-chart">
                      <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                      <path class="circle" [attr.stroke-dasharray]="submission.analysis.aiInfluenceScore + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    </svg>
                    <span class="ring-value">{{ submission.analysis.aiInfluenceScore }}</span>
                  </div>
                  <div class="metric-text">
                    <span class="metric-label">AI Influence</span>
                    <span class="metric-sublabel" [class.high]="submission.analysis.aiInfluenceScore >= 70" [class.medium]="submission.analysis.aiInfluenceScore >= 40 && submission.analysis.aiInfluenceScore < 70" [class.low]="submission.analysis.aiInfluenceScore < 40">
                      {{ submission.analysis.aiInfluenceScore >= 70 ? 'High' : (submission.analysis.aiInfluenceScore >= 40 ? 'Medium' : 'Low') }}
                    </span>
                  </div>
                </div>

                <div class="metric-divider"></div>

                <div class="metric-item">
                  <div class="metric-ring" [class.high]="submission.analysis.aiPatternPercentage >= 70" [class.medium]="submission.analysis.aiPatternPercentage >= 40 && submission.analysis.aiPatternPercentage < 70" [class.low]="submission.analysis.aiPatternPercentage < 40">
                    <svg viewBox="0 0 36 36" class="circular-chart">
                      <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                      <path class="circle" [attr.stroke-dasharray]="submission.analysis.aiPatternPercentage + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    </svg>
                    <span class="ring-value">{{ submission.analysis.aiPatternPercentage | number:'1.0-0' }}</span>
                  </div>
                  <div class="metric-text">
                    <span class="metric-label">AI Patterns</span>
                    <span class="metric-sublabel" [class.high]="submission.analysis.aiPatternPercentage >= 70" [class.medium]="submission.analysis.aiPatternPercentage >= 40 && submission.analysis.aiPatternPercentage < 70" [class.low]="submission.analysis.aiPatternPercentage < 40">
                      {{ getDetectedPatternsCount(submission) }} detected
                    </span>
                  </div>
                </div>

                <div class="metric-divider"></div>

                <div class="metric-item">
                  <div class="metric-ring citation" [class.good]="submission.analysis.citationAnalysis.citationScore >= 70" [class.warning]="submission.analysis.citationAnalysis.citationScore >= 40 && submission.analysis.citationAnalysis.citationScore < 70" [class.poor]="submission.analysis.citationAnalysis.citationScore < 40">
                    <svg viewBox="0 0 36 36" class="circular-chart">
                      <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                      <path class="circle" [attr.stroke-dasharray]="submission.analysis.citationAnalysis.citationScore + ', 100'" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    </svg>
                    <span class="ring-value">{{ submission.analysis.citationAnalysis.citationScore }}</span>
                  </div>
                  <div class="metric-text">
                    <span class="metric-label">Citations</span>
                    <span class="metric-sublabel citation-sub" [class.good]="submission.analysis.citationAnalysis.citationScore >= 70" [class.warning]="submission.analysis.citationAnalysis.citationScore >= 40 && submission.analysis.citationAnalysis.citationScore < 70" [class.poor]="submission.analysis.citationAnalysis.citationScore < 40">
                      {{ submission.analysis.citationAnalysis.citedClaims }}/{{ submission.analysis.citationAnalysis.totalClaims }} cited
                    </span>
                  </div>
                </div>

                <div class="metric-divider"></div>

                <div class="metric-item verdict">
                  <div class="verdict-badge" [class.ai]="submission.analysis.aiInfluenceScore >= 60" [class.human]="submission.analysis.aiInfluenceScore < 40" [class.mixed]="submission.analysis.aiInfluenceScore >= 40 && submission.analysis.aiInfluenceScore < 60">
                    <span class="verdict-icon">{{ submission.analysis.aiInfluenceScore >= 60 ? '🤖' : (submission.analysis.aiInfluenceScore < 40 ? '👤' : '⚖️') }}</span>
                  </div>
                  <div class="metric-text">
                    <span class="metric-label">Verdict</span>
                    <span class="verdict-text" [class.ai]="submission.analysis.aiInfluenceScore >= 60" [class.human]="submission.analysis.aiInfluenceScore < 40" [class.mixed]="submission.analysis.aiInfluenceScore >= 40 && submission.analysis.aiInfluenceScore < 60">
                      {{ submission.analysis.aiInfluenceScore >= 60 ? 'Likely AI' : (submission.analysis.aiInfluenceScore < 40 ? 'Likely Human' : 'Mixed') }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Uncited Claims Alert -->
              <div class="uncited-alert" *ngIf="submission.analysis.citationAnalysis.uncitedClaims > 0">
                <span class="alert-icon">⚠️</span>
                <span class="alert-text">{{ submission.analysis.citationAnalysis.uncitedClaims }} uncited claim{{ submission.analysis.citationAnalysis.uncitedClaims > 1 ? 's' : '' }} - statements without references</span>
              </div>

              <!-- Expandable Pattern Tags -->
              <div class="pattern-tags">
                <ng-container *ngFor="let pattern of submission.analysis.patterns">
                  <span *ngIf="pattern.detected" class="pattern-tag" [class.positive]="pattern.weight < 0" [class.negative]="pattern.weight > 0">
                    {{ pattern.weight < 0 ? '✓' : '!' }} {{ pattern.category }}
                    <span class="tag-weight">{{ pattern.weight > 0 ? '+' : '' }}{{ pattern.weight }}</span>
                  </span>
                </ng-container>
              </div>
            </div>

            <!-- Community Voting Section -->
            <div class="voting-section">
              <div class="voting-header">
                <span class="voting-title">🔍 Community Assessment</span>
              </div>

              <div class="vote-bar-container">
                <div class="vote-bar">
                  <div 
                    class="vote-fill ai-fill"
                    [style.width.%]="getAiPercentage(submission)"
                  >
                    <span *ngIf="getAiPercentage(submission) > 15">🤖 {{ submission.votes.ai }}</span>
                  </div>
                  <div 
                    class="vote-fill human-fill"
                    [style.width.%]="getHumanPercentage(submission)"
                  >
                    <span *ngIf="getHumanPercentage(submission) > 15">👤 {{ submission.votes.human }}</span>
                  </div>
                </div>
                <div class="vote-labels">
                  <span class="ai-label">AI Generated</span>
                  <span class="human-label">Human Written</span>
                </div>
              </div>

              <div class="vote-actions">
                <span class="vote-prompt">What's your verdict?</span>
                <div class="vote-buttons">
                  <button 
                    class="vote-btn ai-vote"
                    [class.active]="submission.votes.userVote === 'ai'"
                    (click)="vote(submission.id, 'ai')"
                  >
                    <span class="vote-icon">🤖</span>
                    <span class="vote-text">AI Generated</span>
                  </button>
                  <button 
                    class="vote-btn human-vote"
                    [class.active]="submission.votes.userVote === 'human'"
                    (click)="vote(submission.id, 'human')"
                  >
                    <span class="vote-icon">👤</span>
                    <span class="vote-text">Human Written</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Card Footer -->
            <footer class="card-footer">
              <button class="action-btn">
                <span>💬</span>
                <span>Discuss</span>
              </button>
              <button class="action-btn">
                <span>📊</span>
                <span>Details</span>
              </button>
              <button class="action-btn">
                <span>🔗</span>
                <span>Share</span>
              </button>
              <button class="action-btn">
                <span>🚩</span>
                <span>Report</span>
              </button>
            </footer>
          </article>

          <!-- Empty State -->
          <div *ngIf="submissions().length === 0" class="empty-state">
            <span class="empty-icon">📭</span>
            <h3>No submissions yet</h3>
            <p>Be the first to submit content for review!</p>
          </div>
        </main>

        <!-- Right Sidebar -->
        <aside class="sidebar right-sidebar">
          <div class="sidebar-card stats-card">
            <h3>📊 Review Stats</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-value">{{ getTotalSubmissions() }}</span>
                <span class="stat-label">Total Reviews</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ getAiDetectedCount() }}</span>
                <span class="stat-label">Flagged as AI</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ getHumanDetectedCount() }}</span>
                <span class="stat-label">Confirmed Human</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ getTotalVotes() }}</span>
                <span class="stat-label">Total Votes</span>
              </div>
            </div>
          </div>

          <div class="sidebar-card">
            <h3>💡 Why Review Content?</h3>
            <div class="info-blocks">
              <div class="info-block">
                <span class="info-icon">🛡️</span>
                <div>
                  <h4>Combat Misinformation</h4>
                  <p>Identify AI-generated fake news and misleading content.</p>
                </div>
              </div>
              <div class="info-block">
                <span class="info-icon">🎯</span>
                <div>
                  <h4>Verify Authenticity</h4>
                  <p>Check if LinkedIn posts or articles are genuinely human.</p>
                </div>
              </div>
              <div class="info-block">
                <span class="info-icon">🤝</span>
                <div>
                  <h4>Community Wisdom</h4>
                  <p>Collective intelligence helps identify patterns.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="sidebar-card platform-card">
            <h3>🔗 Supported Platforms</h3>
            <div class="platform-list">
              <div class="platform-item linkedin">
                <span>💼</span> LinkedIn Posts
              </div>
              <div class="platform-item news">
                <span>📰</span> News Articles
              </div>
              <div class="platform-item twitter">
                <span>🐦</span> Twitter/X Posts
              </div>
              <div class="platform-item other">
                <span>📝</span> Any Text Content
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .review-page {
      min-height: 100vh;
    }

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
      background: var(--bg-glass); backdrop-filter: blur(var(--blur-md));
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      border: 1px solid var(--border-default);

      h3 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: var(--text-primary);
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-muted);
        line-height: 1.6;
      }
    }

    .indicator-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
    }

    .ai-list li { color: var(--accent-red); }
    .human-list li { color: var(--accent-green); }

    .main-feed {
      min-width: 0;
    }

    /* Submit Card - Like Create Post */
    .submit-card {
      background: var(--bg-glass); backdrop-filter: blur(var(--blur-md));
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid var(--border-default);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .submit-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .submit-icon {
      font-size: 2.5rem;
    }

    .submit-info {
      display: flex;
      flex-direction: column;
    }

    .submit-title {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 1.1rem;
    }

    .submit-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .submit-body {
      margin-bottom: 1rem;
    }

    .content-input {
      width: 100%;
      background: var(--bg-hover);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1rem;
      color: var(--text-primary);
      font-size: 1rem;
      resize: none;
      font-family: inherit;
      line-height: 1.6;
      transition: all 0.3s ease;

      &:focus {
        outline: none;
        border-color: var(--accent-cyan);
        box-shadow: 0 0 0 3px var(--info-bg);
      }

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .source-section {
      margin: 1rem 0;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .source-label {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .source-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .source-btn {
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.3s ease;
      font-size: 0.8rem;
      min-height: var(--min-touch-target);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-secondary);
      }

      &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

      &.active {
        background: linear-gradient(135deg, var(--accent-cyan), var(--accent-green));
        color: var(--bg-primary);
        font-weight: 600;
        border-color: transparent;
      }
    }

    .url-input {
      width: 100%;
      background: var(--bg-hover);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.75rem 1rem;
      color: var(--text-primary);
      font-size: 0.875rem;
      margin-top: 0.5rem;

      &:focus {
        outline: none;
        border-color: var(--accent-cyan);
      }

      &::placeholder {
        color: var(--text-muted);
      }
    }

    /* AI Declaration Toggle */
    .ai-declaration {
      margin-top: 1rem;
      padding: 1rem;
      background: var(--ai-bg);
      border: 1px solid var(--accent-red);
      border-radius: var(--radius-md);
    }

    .declaration-toggle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      user-select: none;

      input[type="checkbox"] {
        display: none;
      }
    }

    .toggle-track {
      width: 44px;
      height: 24px;
      background: var(--bg-elevated);
      border-radius: 12px;
      position: relative;
      transition: all 0.3s ease;
      flex-shrink: 0;
    }

    .toggle-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: var(--text-muted);
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .declaration-toggle.active .toggle-track {
      background: linear-gradient(135deg, var(--accent-red), var(--accent-purple));
    }

    .declaration-toggle.active .toggle-thumb {
      left: 22px;
      background: #fff;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .toggle-icon {
      font-size: 1.1rem;
    }

    .declaration-hint {
      display: block;
      margin-top: 0.5rem;
      margin-left: 52px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .char-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .ai-badge-small {
      font-size: 0.75rem;
      color: var(--accent-red);
      background: var(--ai-bg);
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-weight: 500;
    }

    .submit-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid var(--border-default);
    }

    .char-count {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .submit-btn {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-green));
      border: none;
      color: var(--bg-primary);
      padding: 0.75rem 2rem;
      border-radius: 25px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      min-height: var(--min-touch-target);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px var(--info-bg);
      }

      &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-default);

      h2 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--text-primary);
      }

      .post-count {
        font-size: 0.875rem;
        color: var(--text-muted);
        background: var(--bg-elevated);
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
      }
    }

    /* Review Card - Social Media Style */
    .review-card {
      background: var(--bg-glass); backdrop-filter: blur(var(--blur-md));
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 1.5rem;
      border: 1px solid var(--border-default);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      }

      &.high-ai {
        border-color: var(--accent-red);
      }

      &.high-human {
        border-color: var(--accent-green);
      }

      &.declared-ai {
        border-color: var(--accent-red);
        box-shadow: 0 8px 32px var(--ai-bg);
      }
    }

    .ai-declared-banner {
      background: linear-gradient(135deg, var(--accent-red), var(--accent-purple));
      padding: 0.6rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .declared-icon {
        font-size: 1rem;
      }

      .declared-text {
        font-size: 0.8rem;
        font-weight: 600;
        color: #fff;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      .declared-time {
        margin-left: auto;
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.7);
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .declare-btn {
      background: var(--ai-bg);
      border: 1px solid var(--accent-red);
      color: var(--accent-red);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 500;
      transition: all 0.3s ease;
      min-height: var(--min-touch-target);

      &:hover {
        background: var(--accent-red);
        color: #fff;
        transform: translateY(-1px);
      }

      &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

      &.active {
        background: linear-gradient(135deg, var(--accent-red), var(--accent-purple));
        color: #fff;
        border-color: transparent;
      }
    }

    .status-banner {
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid var(--border-default);

      .status-icon {
        font-size: 1.25rem;
      }

      .status-text {
        font-size: 0.85rem;
        font-weight: 600;
        color: #fff;
      }

      .confidence-percent {
        margin-left: auto;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.8);
      }
    }

    .card-header {
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .source-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .source-badge {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;

      &.linkedin {
        background: rgba(0, 119, 181, 0.2);
      }

      &.news {
        background: var(--warning-bg);
      }

      &.twitter {
        background: rgba(29, 161, 242, 0.2);
      }

      &.other {
        background: var(--bg-elevated);
      }
    }

    .meta-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .source-name {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 1rem;
    }

    .time-info {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .source-link {
      font-size: 0.8rem;
      color: var(--accent-cyan);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      background: var(--info-bg);
      transition: all 0.3s ease;

      &:hover {
        background: var(--accent-cyan);
        color: var(--bg-primary);
      }
    }

    .card-content {
      padding: 0 1.5rem 1.25rem;
    }

    .content-text {
      color: var(--text-secondary);
      font-size: 1rem;
      line-height: 1.7;
      margin: 0;
      white-space: pre-wrap;
    }

    .indicators-section {
      margin: 0 1.5rem 1rem;
      padding: 1rem;
      background: var(--bg-hover);
      border-radius: var(--radius-md);
    }

    .indicator-group {
      margin-bottom: 0.75rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .indicator-title {
      font-size: 0.75rem;
      font-weight: 500;
      display: block;
      margin-bottom: 0.5rem;

      &.ai-title { color: var(--accent-red); }
      &.human-title { color: var(--accent-green); }
    }

    .indicator-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .tag {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.7rem;

      &.ai-tag {
        background: var(--ai-bg);
        color: var(--accent-red);
      }

      &.human-tag {
        background: var(--human-bg);
        color: var(--accent-green);
      }
    }

    .voting-section {
      margin: 1rem 1.5rem;
      padding: 1rem;
      background: var(--bg-hover);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
    }

    .voting-header {
      margin-bottom: 1rem;
    }

    .voting-title {
      font-size: 0.9rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .vote-bar-container {
      margin-bottom: 1rem;
    }

    .vote-bar {
      height: 32px;
      background: var(--bg-elevated);
      border-radius: 16px;
      display: flex;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .vote-fill {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 600;
      color: #fff;
      transition: width 0.5s ease;

      &.ai-fill {
        background: linear-gradient(135deg, var(--accent-red), var(--accent-purple));
      }

      &.human-fill {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      }
    }

    .vote-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;

      .ai-label { color: var(--accent-red); }
      .human-label { color: var(--accent-green); }
    }

    .vote-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 1rem;
      border-top: 1px solid var(--border-default);
    }

    .vote-prompt {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .vote-buttons {
      display: flex;
      gap: 0.5rem;
    }

    .vote-btn {
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      padding: 0.6rem 1.25rem;
      border-radius: 25px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      color: var(--text-muted);
      font-size: 0.85rem;
      min-height: var(--min-touch-target);

      &:hover {
        background: var(--bg-hover);
        transform: translateY(-1px);
      }

      &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

      &.ai-vote.active {
        background: linear-gradient(135deg, var(--accent-red), var(--accent-purple));
        color: #fff;
        border-color: transparent;
      }

      &.human-vote.active {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        color: #fff;
        border-color: transparent;
      }

      .vote-icon {
        font-size: 1.1rem;
      }
    }

    .card-footer {
      padding: 1rem 1.5rem;
      display: flex;
      gap: 1rem;
      border-top: 1px solid var(--border-default);
    }

    .action-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      transition: all 0.3s ease;
      font-size: 0.85rem;
      min-height: var(--min-touch-target);

      &:hover {
        background: var(--bg-elevated);
        color: var(--text-secondary);
      }

      &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: var(--bg-glass); backdrop-filter: blur(var(--blur-md));
      border-radius: var(--radius-lg);
      border: 1px dashed var(--border-subtle);

      .empty-icon {
        font-size: 4rem;
        display: block;
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0 0 0.5rem;
        color: var(--text-primary);
      }

      p {
        margin: 0;
        color: var(--text-muted);
      }
    }

    /* Right Sidebar */
    .stats-card {
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .stat-item {
        text-align: center;
        padding: 1rem;
        background: var(--bg-hover);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-default);
      }

      .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--accent-cyan);
        margin-bottom: 0.25rem;
      }

      .stat-label {
        font-size: 0.7rem;
        color: var(--text-muted);
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
      background: var(--bg-hover);
      border-radius: var(--radius-sm);

      .info-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      h4 {
        margin: 0 0 0.25rem;
        font-size: 0.875rem;
        color: var(--text-primary);
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 0.75rem;
        color: var(--text-muted);
        line-height: 1.4;
      }
    }

    .platform-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .platform-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;

      &.linkedin {
        background: rgba(0, 119, 181, 0.1);
        color: #0077b5;
      }

      &.news {
        background: var(--warning-bg);
        color: var(--accent-orange);
      }

      &.twitter {
        background: rgba(29, 161, 242, 0.1);
        color: #1da1f2;
      }

      &.other {
        background: var(--bg-elevated);
        color: var(--text-muted);
      }
    }

    /* Analysis Section - Compact Single Line */
    .analysis-section {
      margin: 0 1.5rem 1rem;
      padding: 1rem 1.25rem;
      background: var(--bg-glass); backdrop-filter: blur(var(--blur-sm));
      border-radius: var(--radius-md);
      border: 1px solid var(--accent-cyan);
    }

    .metrics-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .metric-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      min-width: 140px;
    }

    .metric-divider {
      width: 1px;
      height: 40px;
      background: var(--border-default);
    }

    .metric-ring {
      position: relative;
      width: 48px;
      height: 48px;
      flex-shrink: 0;

      .circular-chart {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .circle-bg {
        fill: none;
        stroke: var(--bg-elevated);
        stroke-width: 3;
      }

      .circle {
        fill: none;
        stroke-width: 3;
        stroke-linecap: round;
        transition: stroke-dasharray 0.5s ease;
      }

      &.high .circle { stroke: var(--accent-red); }
      &.medium .circle { stroke: var(--accent-orange); }
      &.low .circle { stroke: var(--accent-green); }
      &.good .circle { stroke: var(--accent-green); }
      &.warning .circle { stroke: var(--accent-orange); }
      &.poor .circle { stroke: var(--accent-red); }

      .ring-value {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--text-primary);
      }
    }

    .metric-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .metric-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .metric-sublabel {
      font-size: 0.7rem;
      font-weight: 600;

      &.high { color: var(--accent-red); }
      &.medium { color: var(--accent-orange); }
      &.low { color: var(--accent-green); }
      &.good { color: var(--accent-green); }
      &.warning { color: var(--accent-orange); }
      &.poor { color: var(--accent-red); }
    }

    .verdict {
      flex: 0 0 auto;
    }

    .verdict-badge {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;

      &.ai {
        background: var(--ai-bg);
        border: 1px solid var(--accent-red);
      }

      &.human {
        background: var(--human-bg);
        border: 1px solid var(--accent-green);
      }

      &.mixed {
        background: var(--warning-bg);
        border: 1px solid var(--accent-orange);
      }
    }

    .verdict-text {
      font-size: 0.75rem;
      font-weight: 700;

      &.ai { color: var(--accent-red); }
      &.human { color: var(--accent-green); }
      &.mixed { color: var(--accent-orange); }
    }

    .uncited-alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: var(--warning-bg);
      border-radius: var(--radius-sm);
      border-left: 3px solid var(--accent-orange);

      .alert-icon {
        font-size: 0.9rem;
      }

      .alert-text {
        font-size: 0.75rem;
        color: var(--accent-orange);
      }
    }

    .pattern-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-default);
    }

    .pattern-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.65rem;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 500;
      transition: all 0.2s ease;

      &.positive {
        background: var(--human-bg);
        color: var(--accent-green);
        border: 1px solid var(--accent-green);
      }

      &.negative {
        background: var(--ai-bg);
        color: var(--accent-red);
        border: 1px solid var(--accent-red);
      }

      &:hover {
        transform: translateY(-1px);
      }

      .tag-weight {
        font-size: 0.65rem;
        opacity: 0.8;
        font-weight: 600;
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

      .metrics-bar {
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .metric-divider {
        display: none;
      }

      .metric-item {
        min-width: 120px;
      }
    }

    @media (max-width: 768px) {
      .source-section {
        flex-direction: column;
        align-items: flex-start;
      }

      .vote-actions {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .vote-buttons {
        flex-direction: column;
      }

      .vote-btn {
        justify-content: center;
      }

      .card-footer {
        flex-wrap: wrap;
        justify-content: center;
      }

      .metrics-bar {
        justify-content: center;
      }

      .analysis-section {
        margin: 0 1rem 1rem;
        padding: 0.875rem;
      }

      .pattern-tags {
        justify-content: center;
      }
    }
  `]
})
export class ContentReviewComponent {
  private reviewService = inject(ContentReviewService);

  submissions = this.reviewService.submissions;

  contentText = '';
  sourceUrl = '';
  selectedSource = signal<'linkedin' | 'news' | 'twitter' | 'other'>('linkedin');
  declareAsAi = signal<boolean>(false);

  sources = [
    { value: 'linkedin' as const, label: 'LinkedIn', icon: '💼' },
    { value: 'news' as const, label: 'News', icon: '📰' },
    { value: 'twitter' as const, label: 'Twitter/X', icon: '🐦' },
    { value: 'other' as const, label: 'Other', icon: '📝' }
  ];

  submitForReview(): void {
    if (this.contentText.trim() && this.contentText.length >= 20) {
      this.reviewService.submitForReview(
        this.contentText.trim(),
        this.selectedSource(),
        this.sourceUrl.trim() || undefined,
        this.declareAsAi()
      );
      this.contentText = '';
      this.sourceUrl = '';
      this.declareAsAi.set(false);
    }
  }

  toggleAiDeclaration(submissionId: string): void {
    this.reviewService.toggleAiDeclaration(submissionId);
  }

  vote(submissionId: string, vote: 'ai' | 'human'): void {
    this.reviewService.vote(submissionId, vote);
  }

  getConfidence(submission: ReviewSubmission) {
    return this.reviewService.getConfidence(submission);
  }

  getConfidencePercent(submission: ReviewSubmission): number {
    const total = submission.votes.ai + submission.votes.human;
    if (total === 0) return 0;
    const aiPercent = (submission.votes.ai / total) * 100;
    return Math.round(aiPercent >= 50 ? aiPercent : 100 - aiPercent);
  }

  getBannerGradient(submission: ReviewSubmission): string {
    const aiPercent = this.getAiPercentage(submission);
    if (aiPercent >= 70) {
      return 'linear-gradient(135deg, rgba(179, 146, 240, 0.9), rgba(148, 115, 210, 0.9))';
    } else if (aiPercent < 30) {
      return 'linear-gradient(135deg, rgba(88, 166, 255, 0.9), rgba(65, 140, 230, 0.9))';
    }
    return 'linear-gradient(135deg, rgba(212, 160, 84, 0.9), rgba(190, 140, 60, 0.9))';
  }

  getAiPercentage(submission: ReviewSubmission): number {
    const total = submission.votes.ai + submission.votes.human;
    if (total === 0) return 50;
    return (submission.votes.ai / total) * 100;
  }

  getHumanPercentage(submission: ReviewSubmission): number {
    return 100 - this.getAiPercentage(submission);
  }

  getSourceIcon(source: string): string {
    const src = this.sources.find(s => s.value === source);
    return src?.icon || '📝';
  }

  getSourceLabel(source: string): string {
    const src = this.sources.find(s => s.value === source);
    return src?.label || 'Other';
  }

  getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getTotalSubmissions(): number {
    return this.submissions().length;
  }

  getAiDetectedCount(): number {
    return this.submissions().filter(s => {
      const total = s.votes.ai + s.votes.human;
      if (total === 0) return false;
      return (s.votes.ai / total) >= 0.7;
    }).length;
  }

  getHumanDetectedCount(): number {
    return this.submissions().filter(s => {
      const total = s.votes.ai + s.votes.human;
      if (total === 0) return false;
      return (s.votes.human / total) >= 0.7;
    }).length;
  }

  getTotalVotes(): number {
    return this.submissions().reduce((sum, s) => sum + s.votes.ai + s.votes.human, 0);
  }

  getDetectedPatternsCount(submission: ReviewSubmission): number {
    return submission.analysis.patterns.filter(p => p.detected).length;
  }
}

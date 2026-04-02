import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Post } from '../../models/post.model';
import { PostService } from '../../services/post.service';
import { ExposureTrackerService } from '../../services/exposure-tracker.service';
import { AnalysisStatusComponent } from '../analysis-status/analysis-status.component';
import { BiasDetailsModalComponent } from '../bias-details-modal/bias-details-modal.component';
import { ReportExportComponent } from '../report-export/report-export.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, UpperCasePipe, AnalysisStatusComponent, BiasDetailsModalComponent, ReportExportComponent, IconComponent],
  template: `
    <article class="post-card" [class.ai-generated]="post.isAiGenerated" [class.bias-flagged]="post.biasResult?.favoritismFlag" [class.ai-analyzed]="post.aiAnalyzed"
             [attr.aria-label]="'Post by ' + post.author.name">
      <!-- AI Generated Badge -->
      <div class="ai-status-banner" *ngIf="post.isAiGenerated" role="status">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/>
        </svg>
        <span>Author declared: AI-Generated Content</span>
      </div>

      <!-- AI Analysis Notification Banner -->
      <div class="ai-notification-banner" *ngIf="post.aiAnalyzed" role="status" aria-label="AI analysis available">
        <div class="ai-notif-icon-area" aria-hidden="true">
          <span class="ai-notif-pulse"></span>
          <svg class="ai-notif-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <div class="ai-notif-body">
          <span class="ai-notif-title">AI-Influenced Suggestions Available</span>
          <span class="ai-notif-sub">Analyzed by 5 regional AI bias agents + 1 baseline. Review bias indicators before adopting.</span>
        </div>
        <span class="ai-notif-badge" [class]="'severity-' + (post.biasDetection?.overallBiasLevel ?? 'low')">
          {{ post.biasDetection?.overallBiasLevel ?? 'analyzed' | uppercase }}
        </span>
      </div>

      <!-- Favoritism Warning Badge -->
      <div class="bias-warning-banner" *ngIf="post.biasResult?.favoritismFlag" role="alert">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
        <span class="bias-text">Bias Favoritism Detected — {{ post.biasResult!.dominantBiasedAgent }} → {{ post.biasResult!.favoredRegion }}</span>
        <span class="bias-deducted">Deducted: {{ post.biasResult!.deductedBiasAmount | number:'1.3-3' }}</span>
      </div>

      <!-- Post Header -->
      <header class="post-header">
        <div class="author-section">
          <div class="avatar-ring" [class.ai-ring]="post.isAiGenerated" [class.human-ring]="!post.isAiGenerated">
            <img [src]="post.author.avatarUrl" [alt]="'Avatar of ' + post.author.name" class="avatar" />
          </div>
          <div class="author-info">
            <div class="author-name-row">
              <span class="author-name">{{ post.author.name }}</span>
              <span class="verified-badge" *ngIf="post.author.isVerified" aria-label="Verified account">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </span>
              <span class="ai-author-badge" *ngIf="post.isAiGenerated">AI</span>
              <app-analysis-status [status]="post.analysisStatus" *ngIf="post.analysisRequested" />
            </div>
            <span class="author-username">&#64;{{ post.author.username }} · {{ post.createdAt | date:'shortTime' }} · {{ post.contentType }}</span>
          </div>
        </div>
        <div class="post-header-actions">
          <button class="icon-btn notify-btn" [class.active]="notifyEnabled()" (click)="toggleNotify()"
                  [attr.aria-label]="notifyEnabled() ? 'Disable notifications for this post' : 'Enable notifications for this post'"
                  [attr.aria-pressed]="notifyEnabled()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" [attr.stroke]="notifyEnabled() ? 'var(--accent-orange)' : 'var(--text-muted)'" stroke-width="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </button>
          <div class="more-menu-wrap">
            <button class="icon-btn" (click)="toggleMoreMenu()" aria-label="More options" [attr.aria-expanded]="showMoreMenu()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--text-muted)" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            <div class="more-menu-backdrop" *ngIf="showMoreMenu()" (click)="showMoreMenu.set(false)"></div>
            <div class="more-dropdown" *ngIf="showMoreMenu()" role="menu" aria-label="Post options">
              <button class="dropdown-item" role="menuitem" (click)="reportAsAi()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ai-color)" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/></svg>
                Flag as AI-Generated
              </button>
              <button class="dropdown-item" role="menuitem" (click)="reportAsHuman()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Flag as Human-Made
              </button>
              <button class="dropdown-item" role="menuitem" (click)="toggleNotify(); showMoreMenu.set(false)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                {{ notifyEnabled() ? 'Mute Notifications' : 'Get AI Notifications' }}
              </button>
              <button class="dropdown-item danger" role="menuitem" (click)="showMoreMenu.set(false)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                Report Misleading Content
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Post Content -->
      <div class="post-content">
        <p class="content-text">{{ post.content }}</p>
        <img *ngIf="post.imageUrl" [src]="post.imageUrl" [alt]="'Image posted by ' + post.author.name" class="post-image" loading="lazy" />
      </div>

      <!-- AI Likelihood Indicator Strip -->
      <div class="ai-likelihood-strip" [class]="'likelihood-' + getAiLikelihood()" role="status"
           [attr.aria-label]="'AI likelihood: ' + (getAiLikelihood() === 'ai' ? 'Looks AI-Generated' : getAiLikelihood() === 'human' ? 'Looks Human-Made' : 'Disputed')">
        <svg *ngIf="getAiLikelihood() === 'ai'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/></svg>
        <svg *ngIf="getAiLikelihood() === 'human'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <svg *ngIf="getAiLikelihood() === 'disputed'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span class="lk-label">
          {{ getAiLikelihood() === 'ai' ? 'Looks AI-Generated' : getAiLikelihood() === 'human' ? 'Looks Human-Made' : 'Disputed · Mixed Signals' }}
        </span>
        <span class="lk-votes">{{ post.aiGeneratedFeedback.flaggedAsAi + post.aiGeneratedFeedback.flaggedAsHuman }} votes</span>
        <span class="lk-pill" [style.background]="confidence.color">{{ confidence.level }}</span>
      </div>

      <!-- Provenance Indicators -->
      <div class="provenance-section" *ngIf="post.provenance?.length" role="region" aria-label="Provenance indicators">
        <div class="provenance-header">
          <span class="provenance-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Provenance Indicators
          </span>
          <span class="provenance-note">Neutral evidence — not a judgment</span>
        </div>
        <div class="provenance-indicators">
          <div class="provenance-item" *ngFor="let p of post.provenance" [class]="'prov-' + p.source">
            <span class="prov-icon" aria-hidden="true">{{ getProvenanceIcon(p.source) }}</span>
            <div class="prov-body">
              <span class="prov-label">{{ p.label }}</span>
              <span class="prov-reasoning">{{ p.reasoning }}</span>
            </div>
            <div class="prov-confidence">
              <div class="prov-conf-bar" role="progressbar" [attr.aria-valuenow]="p.confidence * 100" aria-valuemin="0" aria-valuemax="100"><div class="prov-conf-fill" [style.width.%]="p.confidence * 100"></div></div>
              <span class="prov-conf-text">{{ p.confidence * 100 | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Expert Escalation -->
      <div class="expert-escalation" *ngIf="post.expertEscalation?.escalated" [class]="'risk-' + post.expertEscalation!.riskLevel" role="alert">
        <div class="escalation-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span class="escalation-title">Expert Review {{ post.expertEscalation!.expertVerdict ? 'Complete' : 'Pending' }}</span>
          <span class="risk-badge">{{ post.expertEscalation!.riskLevel | uppercase }} RISK</span>
        </div>
        <p class="escalation-reason">{{ post.expertEscalation!.reason }}</p>
        <p class="expert-verdict" *ngIf="post.expertEscalation!.expertVerdict">
          Expert finding: {{ post.expertEscalation!.expertVerdict }}
        </p>
      </div>

      <!-- Bias Analysis Results -->
      <div class="bias-results-section" *ngIf="post.biasResult" role="region" aria-label="Bias analysis results">
        <div class="bias-results-header">
          <span class="results-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Bias Analysis (Simulated)
          </span>
          <button class="details-btn" (click)="showDetails.set(true)" aria-label="View detailed bias analysis">View Details</button>
        </div>
        <div class="score-cards" role="group" aria-label="Bias scores">
          <div class="score-card raw">
            <span class="score-label">Raw Biased</span>
            <span class="score-value">{{ post.biasResult.rawBiasedScore | number:'1.3-3' }}</span>
          </div>
          <div class="score-card baseline">
            <span class="score-label">Baseline</span>
            <span class="score-value">{{ post.biasResult.baselineNonbiasedScore | number:'1.3-3' }}</span>
          </div>
          <div class="score-card debiased">
            <span class="score-label">Debiased</span>
            <span class="score-value">{{ post.biasResult.debiasedAdjustedScore | number:'1.3-3' }}</span>
          </div>
        </div>
        <div class="bias-meta" *ngIf="post.biasResult.favoritismFlag">
          <span class="meta-item">Δ {{ post.biasResult.biasDelta | number:'1.3-3' }}</span>
          <span class="meta-item">{{ post.biasResult.favoredRegion }}</span>
          <span class="meta-item">{{ post.biasResult.dominantBiasedAgent }}</span>
        </div>
        <div class="bias-explanation" *ngIf="post.biasResult.explanationSummary">
          <p>{{ post.biasResult.explanationSummary }}</p>
        </div>
        <div class="report-row">
          <app-report-export [postId]="post.id" />
        </div>
      </div>

      <!-- Regional Agent Verdicts -->
      <div class="agent-verdicts-section" *ngIf="post.agentScores?.length" role="region" aria-label="Regional agent verdicts">
        <div class="agent-verdicts-header">
          <span class="verdicts-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            Regional Agent Verdicts
          </span>
          <button class="toggle-agents-btn" (click)="showAgents.set(!showAgents())"
                  [attr.aria-expanded]="showAgents()" aria-label="Toggle agent verdicts">
            {{ showAgents() ? 'Collapse' : 'Expand' }}
          </button>
        </div>

        <div class="agent-grid" *ngIf="showAgents()">
          <div
            class="agent-card"
            *ngFor="let agent of post.agentScores"
            [class.highest-bias]="agent.agentName === post.biasDetection?.mostBiasedAgent"
            [class.lowest-bias]="agent.agentName === post.biasDetection?.leastBiasedAgent"
          >
            <div class="agent-card-header">
              <span class="agent-region-flag" aria-hidden="true">{{ getRegionFlag(agent.region) }}</span>
              <span class="agent-name">{{ agent.region ?? 'Baseline' }}</span>
              <span class="agent-score" [style.color]="getScoreColor(agent.score)">{{ agent.score | number:'1.2-2' }}</span>
            </div>
            <div class="agent-confidence">
              <div class="conf-bar" role="progressbar" [attr.aria-valuenow]="agent.confidence * 100" aria-valuemin="0" aria-valuemax="100">
                <div class="conf-fill" [style.width.%]="agent.confidence * 100"></div>
              </div>
              <span class="conf-label">{{ agent.confidence * 100 | number:'1.0-0' }}% conf</span>
            </div>
            <p class="agent-reasoning">{{ agent.reasoning }}</p>
            <div class="agent-highlights" *ngIf="agent.biasHighlights.length">
              <span class="highlight-tag" *ngFor="let h of agent.biasHighlights">{{ h }}</span>
            </div>
          </div>
        </div>

        <!-- Bias Detection Summary -->
        <div class="bias-detection-summary" *ngIf="post.biasDetection">
          <div class="detection-header">
            <span class="detection-label">Bias Detection</span>
            <span class="detection-level" [class]="'level-' + post.biasDetection.overallBiasLevel">
              {{ post.biasDetection.overallBiasLevel | uppercase }}
            </span>
          </div>
          <p class="detection-summary">{{ post.biasDetection.summary }}</p>
          <div class="flagged-items" *ngIf="post.biasDetection.flaggedItems.length">
            <div class="flagged-item" *ngFor="let item of post.biasDetection.flaggedItems">
              <div class="flagged-item-header">
                <span class="flagged-agent">{{ getRegionFlag(item.region) }} {{ item.agentName }}</span>
                <span class="flagged-mode" [class]="'mode-' + item.biasMode.toLowerCase()">{{ item.biasMode }}</span>
                <span class="flagged-severity" [class]="'severity-' + item.severity">{{ item.severity }}</span>
              </div>
              <span class="flagged-delta">Δ {{ item.deltaFromBaseline | number:'1.3-3' }}</span>
              <p class="flagged-explanation">{{ item.explanation }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Community AI Verification Section -->
      <div class="ai-verification-section" role="region" aria-label="Community verification">
        <div class="verification-header">
          <span class="verification-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Community Verification
          </span>
          <div class="confidence-badge" [style.background]="confidence.color">
            {{ confidence.level }}
          </div>
        </div>

        <div class="verification-stats">
          <div class="stat-bar" role="img" [attr.aria-label]="getAiPercentage() + '% flagged as AI, ' + getHumanPercentage() + '% flagged as human'">
            <div class="stat-fill ai-fill" [style.width.%]="getAiPercentage()"></div>
            <div class="stat-fill human-fill" [style.width.%]="getHumanPercentage()"></div>
          </div>
          <div class="stat-labels">
            <span class="stat-label ai-label">{{ post.aiGeneratedFeedback.flaggedAsAi }} think AI</span>
            <span class="stat-label human-label">{{ post.aiGeneratedFeedback.flaggedAsHuman }} think Human</span>
          </div>
        </div>

        <div class="vote-section">
          <span class="vote-prompt" id="vote-prompt-{{post.id}}">What do you think?</span>
          <div class="vote-buttons" role="group" [attr.aria-labelledby]="'vote-prompt-' + post.id">
            <button
              class="vote-btn ai-vote"
              [class.active]="post.aiGeneratedFeedback.userVote === 'ai'"
              [attr.aria-pressed]="post.aiGeneratedFeedback.userVote === 'ai'"
              (click)="voteAi()"
              aria-label="Vote: Looks AI-generated"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/></svg>
              <span>Looks AI</span>
            </button>
            <button
              class="vote-btn human-vote"
              [class.active]="post.aiGeneratedFeedback.userVote === 'human'"
              [attr.aria-pressed]="post.aiGeneratedFeedback.userVote === 'human'"
              (click)="voteHuman()"
              aria-label="Vote: Looks human-made"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Looks Human</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Post Footer Actions -->
      <footer class="post-footer">
        <div class="footer-left">
          <button class="action-btn like-btn" (click)="likePost()" [attr.aria-label]="'Like post, ' + post.likes + ' likes'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            <span>{{ post.likes }}</span>
          </button>
          <button class="action-btn" [attr.aria-label]="post.comments.length + ' comments'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span>{{ post.comments.length }}</span>
          </button>
          <button class="action-btn" aria-label="Share this post">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            <span class="action-text">Share</span>
          </button>
        </div>
        <button class="action-btn bookmark-btn" aria-label="Bookmark this post">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        </button>
      </footer>
    </article>

    <app-bias-details-modal
      [result]="post.biasResult ?? null"
      [agentScores]="post.agentScores ?? []"
      [biasDetection]="post.biasDetection ?? null"
      [visible]="showDetails()"
      (close)="showDetails.set(false)"
    />
  `,
  styles: [`
    .post-card {
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      overflow: hidden;
      margin-bottom: var(--space-6);
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-md);
      transition: all var(--transition-fast);

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      &.ai-generated {
        border-color: rgba(188, 140, 255, 0.3);
      }

      &.bias-flagged {
        border-color: rgba(210, 153, 34, 0.4);
        box-shadow: var(--shadow-md), 0 0 16px rgba(210, 153, 34, 0.1);
      }

      &.ai-analyzed {
        border-color: rgba(57, 210, 192, 0.15);
      }
    }

    .ai-status-banner {
      background: var(--ai-bg);
      padding: var(--space-3) var(--space-6);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      border-bottom: 1px solid rgba(188, 140, 255, 0.15);
      font-size: var(--text-xs);
      color: var(--ai-color);
      font-weight: 500;
    }

    .bias-warning-banner {
      background: var(--warning-bg);
      padding: var(--space-2) var(--space-6);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      border-bottom: 1px solid rgba(210, 153, 34, 0.2);
      color: var(--warning-color);
      .bias-text { font-size: var(--text-xs); font-weight: 500; flex: 1; }
      .bias-deducted {
        font-size: 0.7rem;
        background: rgba(210, 153, 34, 0.15);
        color: var(--accent-orange);
        padding: 2px var(--space-3);
        border-radius: var(--radius-full);
        font-weight: 600;
      }
    }

    .post-header {
      padding: var(--space-5) var(--space-6);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .author-section {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: block;
    }

    .avatar-ring {
      flex-shrink: 0;
      padding: 3px;
      border-radius: 50%;
      display: flex;

      &.ai-ring {
        background: linear-gradient(135deg, var(--ai-color), var(--accent-cyan));
      }

      &.human-ring {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      }
    }

    .author-info { display: flex; flex-direction: column; gap: 2px; }
    .author-name-row { display: flex; align-items: center; gap: var(--space-2); }
    .author-name { font-weight: 600; color: var(--text-primary); font-size: var(--text-base); }

    .verified-badge {
      background: var(--accent-blue);
      color: white;
      width: 16px; height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ai-author-badge {
      background: var(--ai-color);
      color: white;
      padding: 1px var(--space-2);
      border-radius: var(--radius-sm);
      font-size: 0.625rem;
      font-weight: 700;
    }

    .author-username {
      font-size: var(--text-sm);
      color: var(--text-muted);
    }

    .post-content {
      padding: 0 var(--space-6);
    }

    .content-text {
      color: var(--text-secondary);
      font-size: var(--text-base);
      line-height: 1.6;
      margin: 0 0 var(--space-4);
    }

    .post-image {
      width: 100%;
      border-radius: var(--radius-lg);
      margin-bottom: var(--space-4);
      max-height: 400px;
      object-fit: cover;
    }

    /* Community Verification */
    .ai-verification-section {
      margin: var(--space-4) var(--space-6);
      padding: var(--space-4);
      background: var(--bg-elevated);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }

    .verification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-4);
    }

    .verification-title {
      font-size: var(--text-sm);
      color: var(--text-muted);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .confidence-badge {
      padding: 2px var(--space-3);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: 600;
      color: white;
    }

    .stat-bar {
      height: 8px;
      background: var(--bg-hover);
      border-radius: var(--radius-sm);
      display: flex;
      overflow: hidden;
      margin-bottom: var(--space-2);
    }

    .stat-fill { height: 100%; transition: width 0.5s ease; }
    .ai-fill { background: var(--ai-color); }
    .human-fill { background: var(--accent-green); }

    .stat-labels { display: flex; justify-content: space-between; }
    .stat-label { font-size: var(--text-xs); display: flex; align-items: center; gap: var(--space-1); }
    .ai-label { color: var(--ai-color); }
    .human-label { color: var(--accent-green); }

    .vote-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }

    .vote-prompt { font-size: var(--text-xs); color: var(--text-muted); }

    .vote-buttons { display: flex; gap: var(--space-2); }

    .vote-btn {
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      transition: all var(--transition-fast);
      color: var(--text-muted);
      font-size: var(--text-xs);

      &:hover { background: var(--bg-hover); }

      &.ai-vote.active {
        background: var(--ai-bg);
        color: var(--ai-color);
        border-color: rgba(188, 140, 255, 0.3);
      }

      &.human-vote.active {
        background: var(--human-bg);
        color: var(--accent-green);
        border-color: rgba(63, 185, 80, 0.3);
      }
    }

    .post-footer {
      padding: var(--space-4) var(--space-6);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border-subtle);
    }

    .footer-left { display: flex; gap: var(--space-6); }

    .action-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      font-size: var(--text-sm);

      &:hover { background: var(--bg-hover); color: var(--text-secondary); }
    }

    .like-btn:hover { color: var(--accent-red); }

    /* Bias results */
    .bias-results-section {
      margin: var(--space-3) var(--space-6);
      padding: var(--space-4);
      background: var(--bg-elevated);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }
    .bias-results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-3);
    }
    .results-title {
      font-size: var(--text-sm);
      color: var(--text-muted);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .details-btn {
      background: var(--info-bg);
      border: 1px solid rgba(88, 166, 255, 0.2);
      color: var(--accent-blue);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      cursor: pointer;
      font-size: 0.7rem;
      transition: all var(--transition-fast);
      &:hover { background: rgba(88, 166, 255, 0.2); }
    }
    .score-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }
    .score-card {
      text-align: center;
      padding: var(--space-3) var(--space-2);
      border-radius: var(--radius-md);
      .score-label { display: block; font-size: 0.65rem; color: var(--text-muted); margin-bottom: 2px; }
      .score-value { display: block; font-size: var(--text-lg); font-weight: 700; }
      &.raw { background: var(--danger-bg); .score-value { color: var(--accent-red); } }
      &.baseline { background: var(--bg-hover); .score-value { color: var(--text-secondary); } }
      &.debiased { background: var(--info-bg); .score-value { color: var(--accent-cyan); } }
    }
    .bias-meta {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin: var(--space-2) 0;
      .meta-item {
        font-size: 0.72rem;
        color: var(--accent-orange);
        background: var(--warning-bg);
        padding: 2px var(--space-3);
        border-radius: var(--radius-full);
      }
    }
    .bias-explanation {
      margin-top: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-left: 3px solid var(--accent-cyan);
      background: var(--bg-elevated);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      p { margin: 0; font-size: var(--text-xs); color: var(--text-muted); line-height: 1.5; }
    }
    .report-row { margin-top: var(--space-2); display: flex; justify-content: flex-end; }

    /* AI Notification Banner */
    .ai-notification-banner {
      background: var(--info-bg);
      padding: var(--space-3) var(--space-6);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      border-bottom: 1px solid rgba(57, 210, 192, 0.15);
    }
    .ai-notif-icon-area { position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
    .ai-notif-pulse {
      position: absolute; width: 32px; height: 32px; border-radius: 50%;
      background: rgba(57, 210, 192, 0.2); animation: notifPulse 2s ease-in-out infinite;
    }
    @keyframes notifPulse { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.4); opacity: 0; } }
    .ai-notif-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .ai-notif-title { font-size: var(--text-xs); font-weight: 600; color: var(--accent-cyan); }
    .ai-notif-sub { font-size: 0.68rem; color: var(--text-muted); }
    .ai-notif-badge {
      font-size: 0.6rem; font-weight: 700; padding: 2px var(--space-3); border-radius: var(--radius-full);
      text-transform: uppercase; letter-spacing: 0.5px;
      &.severity-low { background: var(--status-confirm-bg); color: var(--status-confirm); }
      &.severity-medium { background: var(--status-notice-bg); color: var(--status-notice); }
      &.severity-high { background: var(--status-critical-bg); color: var(--status-critical); }
      &.severity-critical { background: var(--status-critical-bg); color: var(--status-critical); }
      &.severity-analyzed { background: var(--status-info-bg); color: var(--accent-primary); }
    }

    /* Provenance Indicators */
    .provenance-section {
      margin: var(--space-3) var(--space-6);
      padding: var(--space-3);
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }
    .provenance-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); }
    .provenance-title { font-size: var(--text-xs); color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: var(--space-2); }
    .provenance-note { font-size: 0.62rem; color: var(--text-muted); font-style: italic; }
    .provenance-indicators { display: flex; flex-direction: column; gap: var(--space-2); }
    .provenance-item {
      display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md); background: var(--bg-hover);
    }
    .prov-icon { font-size: 1rem; flex-shrink: 0; }
    .prov-body { flex: 1; display: flex; flex-direction: column; }
    .prov-label { font-size: 0.72rem; color: var(--text-secondary); font-weight: 500; }
    .prov-reasoning { font-size: 0.65rem; color: var(--text-muted); }
    .prov-confidence { display: flex; align-items: center; gap: var(--space-2); min-width: 70px; }
    .prov-conf-bar { height: 4px; flex: 1; background: var(--bg-hover); border-radius: 2px; overflow: hidden; }
    .prov-conf-fill { height: 100%; background: var(--accent-cyan); border-radius: 2px; }
    .prov-conf-text { font-size: 0.6rem; color: var(--text-muted); }

    /* Expert Escalation */
    .expert-escalation {
      margin: var(--space-2) var(--space-6); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md);
      &.risk-low { background: var(--human-bg); border: 1px solid rgba(63, 185, 80, 0.15); }
      &.risk-medium { background: var(--warning-bg); border: 1px solid rgba(210, 153, 34, 0.15); }
      &.risk-high { background: var(--danger-bg); border: 1px solid rgba(248, 81, 73, 0.15); }
      &.risk-critical { background: var(--status-critical-bg); border: 1px solid var(--status-critical); }
    }
    .escalation-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
    .escalation-title { font-size: var(--text-xs); color: var(--text-primary); font-weight: 600; flex: 1; }
    .risk-badge {
      font-size: 0.6rem; font-weight: 700; padding: 2px var(--space-2); border-radius: var(--radius-sm);
      background: var(--danger-bg); color: var(--accent-red); letter-spacing: 0.5px;
    }
    .escalation-reason { margin: 0 0 var(--space-1); font-size: 0.72rem; color: var(--text-muted); }
    .expert-verdict {
      margin: 0; padding: var(--space-2) var(--space-3); font-size: var(--text-xs); color: var(--text-secondary);
      background: var(--bg-elevated); border-left: 3px solid var(--accent-cyan); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }

    /* Agent Verdicts */
    .agent-verdicts-section {
      margin: var(--space-3) var(--space-6); padding: var(--space-3);
      background: var(--bg-elevated);
      border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);
    }
    .agent-verdicts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); }
    .verdicts-title { font-size: var(--text-sm); color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: var(--space-2); }
    .toggle-agents-btn {
      background: var(--bg-hover); border: 1px solid var(--border-default);
      color: var(--text-secondary); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full);
      cursor: pointer; font-size: 0.65rem; transition: all var(--transition-fast);
      &:hover { background: var(--bg-elevated); }
    }
    .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-3); }
    .agent-card {
      padding: var(--space-3); border-radius: var(--radius-md); background: var(--bg-hover);
      border: 1px solid var(--border-subtle); transition: all var(--transition-fast);
      &.highest-bias { border-color: rgba(248, 81, 73, 0.3); background: var(--danger-bg); }
      &.lowest-bias { border-color: rgba(63, 185, 80, 0.3); background: var(--human-bg); }
    }
    .agent-card-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
    .agent-region-flag { font-size: 1.1rem; }
    .agent-name { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; flex: 1; }
    .agent-score { font-size: var(--text-base); font-weight: 700; }
    .agent-confidence { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
    .conf-bar { height: 3px; flex: 1; background: var(--bg-hover); border-radius: 2px; overflow: hidden; }
    .conf-fill { height: 100%; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-green)); border-radius: 2px; }
    .conf-label { font-size: 0.6rem; color: var(--text-muted); }
    .agent-reasoning { margin: 0 0 var(--space-1); font-size: 0.65rem; color: var(--text-muted); line-height: 1.4; }
    .agent-highlights { display: flex; flex-wrap: wrap; gap: 2px; }
    .highlight-tag {
      font-size: 0.55rem; padding: 1px var(--space-2); border-radius: var(--radius-sm);
      background: var(--warning-bg); color: var(--accent-orange); white-space: nowrap;
    }

    /* Bias Detection Summary */
    .bias-detection-summary {
      padding: var(--space-3); background: var(--bg-hover); border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }
    .detection-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
    .detection-label { font-size: var(--text-xs); color: var(--text-muted); font-weight: 500; flex: 1; }
    .detection-level {
      font-size: 0.6rem; font-weight: 700; padding: 2px var(--space-2); border-radius: var(--radius-sm);
      &.level-low { background: var(--status-confirm-bg); color: var(--status-confirm); }
      &.level-medium { background: var(--status-notice-bg); color: var(--status-notice); }
      &.level-high { background: var(--status-critical-bg); color: var(--status-critical); }
      &.level-critical { background: var(--status-critical-bg); color: var(--status-critical); }
    }
    .detection-summary { margin: 0 0 var(--space-2); font-size: 0.7rem; color: var(--text-muted); line-height: 1.5; }
    .flagged-items { display: flex; flex-direction: column; gap: var(--space-2); }
    .flagged-item {
      padding: var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm);
      border-left: 3px solid rgba(210, 153, 34, 0.4);
    }
    .flagged-item-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: 2px; flex-wrap: wrap; }
    .flagged-agent { font-size: 0.7rem; color: var(--text-secondary); font-weight: 500; }
    .flagged-mode {
      font-size: 0.55rem; font-weight: 700; padding: 1px var(--space-1); border-radius: var(--radius-sm);
      &.mode-inflation { background: var(--danger-bg); color: var(--accent-red); }
      &.mode-deflation { background: var(--info-bg); color: var(--accent-blue); }
      &.mode-selective { background: var(--warning-bg); color: var(--accent-orange); }
      &.mode-neutral { background: var(--bg-hover); color: var(--text-muted); }
    }
    .flagged-severity {
      font-size: 0.55rem; font-weight: 600; padding: 1px var(--space-1); border-radius: var(--radius-sm);
      &.severity-negligible { background: var(--bg-hover); color: var(--text-muted); }
      &.severity-low { background: var(--status-confirm-bg); color: var(--status-confirm); }
      &.severity-medium { background: var(--status-notice-bg); color: var(--status-notice); }
      &.severity-high { background: var(--status-critical-bg); color: var(--status-critical); }
      &.severity-critical { background: var(--status-critical-bg); color: var(--status-critical); }
    }
    .flagged-delta { font-size: 0.62rem; color: var(--accent-orange); }
    .flagged-explanation { margin: 2px 0 0; font-size: 0.62rem; color: var(--text-muted); line-height: 1.4; }

    /* Header actions + menu */
    .post-header-actions { display: flex; align-items: center; gap: var(--space-2); }

    .icon-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: var(--space-2);
      border-radius: 50%;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      min-height: 36px;
      &:hover { background: var(--bg-hover); color: var(--text-primary); }
      &.active { color: var(--accent-orange); }
    }

    .more-menu-wrap { position: relative; }
    .more-menu-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99; }
    .more-dropdown {
      position: absolute; right: 0; top: 100%;
      background: var(--bg-secondary); border: 1px solid var(--border-default);
      border-radius: var(--radius-lg); padding: var(--space-2) 0;
      min-width: 230px; box-shadow: var(--shadow-xl);
      z-index: 100; animation: fadeInUp 0.2s ease;
    }
    .dropdown-item {
      display: flex; align-items: center; gap: var(--space-3);
      width: 100%; padding: var(--space-3) var(--space-4);
      background: none; border: none; color: var(--text-secondary);
      font-size: var(--text-xs); cursor: pointer; transition: background var(--transition-fast); text-align: left;
      &:hover { background: var(--bg-hover); }
      &.danger { color: var(--accent-red); }
    }

    /* AI Likelihood Strip */
    .ai-likelihood-strip {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-6);
      border-top: 1px solid var(--border-subtle);
      font-size: var(--text-xs);

      .lk-label { font-weight: 600; flex: 1; }
      .lk-votes { font-size: 0.7rem; color: var(--text-muted); }
      .lk-pill {
        font-size: 0.65rem; font-weight: 700;
        padding: 2px var(--space-3); border-radius: var(--radius-full); color: white;
      }

      &.likelihood-ai {
        background: var(--ai-bg);
        .lk-label { color: var(--ai-color); }
      }
      &.likelihood-human {
        background: var(--human-bg);
        .lk-label { color: var(--accent-green); }
      }
      &.likelihood-disputed {
        background: var(--warning-bg);
        .lk-label { color: var(--accent-orange); }
      }
    }

    .bookmark-btn {
      margin-left: auto;
      &:hover { color: var(--accent-orange) !important; }
    }

    @media (max-width: 480px) {
      .vote-section { flex-direction: column; gap: var(--space-3); align-items: flex-start; }
      .vote-buttons { width: 100%; }
      .vote-btn { flex: 1; justify-content: center; }
    }

    @media (forced-colors: active) {
      .post-card { border: 2px solid ButtonText; }
      .vote-btn.active { outline: 2px solid Highlight; }
      .stat-fill { forced-color-adjust: none; }
    }
  `]
})
export class PostCardComponent implements OnInit {
  @Input({ required: true }) post!: Post;

  private postService = inject(PostService);
  private exposureTracker = inject(ExposureTrackerService);
  showDetails = signal(false);
  showAgents = signal(false);
  showMoreMenu = signal(false);
  notifyEnabled = signal(false);

  private regionFlags: Record<string, string> = {
    'Africa': '🌍', 'Asia': '🌏', 'Europe': '🇪🇺', 'Americas': '🌎', 'Oceania': '🏝️'
  };

  ngOnInit(): void {
    // Record exposure for feedback monitoring (proposal §Overview: micro-probes)
    this.exposureTracker.recordExposure(
      this.post.id,
      this.post.contentType,
      this.post.isAiGenerated,
      this.post.biasResult?.biasDelta ?? 0,
    );
  }

  get confidence() {
    return this.postService.getAiConfidenceLevel(this.post);
  }

  getRegionFlag(region: string | null): string {
    return region ? (this.regionFlags[region] ?? '🌐') : '⚖️';
  }

  getScoreColor(score: number): string {
    if (score >= 0.8) return '#d47766';
    if (score >= 0.6) return '#d4a054';
    if (score >= 0.4) return '#d4a054';
    return '#56d4c4';
  }

  getProvenanceIcon(source: string): string {
    switch (source) {
      case 'author-declaration': return '✍️';
      case 'community-consensus': return '👥';
      case 'ai-analysis': return '🧠';
      case 'expert-review': return '🎓';
      default: return '🔐';
    }
  }

  getAiPercentage(): number {
    const total = this.post.aiGeneratedFeedback.flaggedAsAi + this.post.aiGeneratedFeedback.flaggedAsHuman;
    if (total === 0) return 50;
    return (this.post.aiGeneratedFeedback.flaggedAsAi / total) * 100;
  }

  getHumanPercentage(): number {
    return 100 - this.getAiPercentage();
  }

  voteAi(): void {
    this.postService.voteOnAiStatus(this.post.id, 'ai');
    this.exposureTracker.recordVote(this.post.id, 'ai');
  }

  voteHuman(): void {
    this.postService.voteOnAiStatus(this.post.id, 'human');
    this.exposureTracker.recordVote(this.post.id, 'human');
  }

  getAiLikelihood(): 'ai' | 'human' | 'disputed' {
    const total = this.post.aiGeneratedFeedback.flaggedAsAi + this.post.aiGeneratedFeedback.flaggedAsHuman;
    if (total === 0) return this.post.isAiGenerated ? 'ai' : 'human';
    const aiRatio = this.post.aiGeneratedFeedback.flaggedAsAi / total;
    if (aiRatio >= 0.6) return 'ai';
    if (aiRatio <= 0.4) return 'human';
    return 'disputed';
  }

  toggleNotify(): void {
    this.notifyEnabled.update(v => !v);
  }

  toggleMoreMenu(): void {
    this.showMoreMenu.update(v => !v);
  }

  reportAsAi(): void {
    this.voteAi();
    this.showMoreMenu.set(false);
  }

  reportAsHuman(): void {
    this.voteHuman();
    this.showMoreMenu.set(false);
  }

  likePost(): void {
    this.postService.likePost(this.post.id);
  }
}

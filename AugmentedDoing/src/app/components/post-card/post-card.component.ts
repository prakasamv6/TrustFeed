import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Post } from '../../models/post.model';
import { PostService } from '../../services/post.service';
import { ExposureTrackerService } from '../../services/exposure-tracker.service';
import { AiFlagService } from '../../services/ai-flag.service';
import { ContentTrustResult } from '../../models/analysis.model';
import { AnalysisStatusComponent } from '../analysis-status/analysis-status.component';
import { BiasDetailsModalComponent } from '../bias-details-modal/bias-details-modal.component';
import { ReportExportComponent } from '../report-export/report-export.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [DatePipe, DecimalPipe, UpperCasePipe, AnalysisStatusComponent, BiasDetailsModalComponent, ReportExportComponent, IconComponent],
  template: `
    <article class="post-card" [class.ai-generated]="post.isAiGenerated" [class.bias-flagged]="post.biasResult?.favoritismFlag" [class.ai-analyzed]="post.aiAnalyzed"
             [attr.aria-label]="'Post by ' + post.author.name">
      <!-- AI Generated Badge -->
      @if (post.isAiGenerated) {
      <div class="ai-status-banner" role="status">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/>
        </svg>
        <span>Author declared: AI-Generated Content</span>
      </div>
      }

      <!-- AI Analysis Notification Banner -->
      @if (post.aiAnalyzed) {
      <div class="ai-notification-banner" role="status" aria-label="AI analysis available">
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
      }

      <!-- Favoritism Warning Badge -->
      @if (post.biasResult?.favoritismFlag) {
      <div class="bias-warning-banner" role="alert">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
        <span class="bias-text">Bias Favoritism Detected — {{ post.biasResult?.dominantBiasedAgent }} → {{ post.biasResult?.favoredRegion }}</span>
        <span class="bias-deducted">Deducted: {{ post.biasResult?.deductedBiasAmount | number:'1.3-3' }}</span>
      </div>
      }

      <!-- Post Header -->
      <header class="post-header">
        <div class="author-section">
          <div class="avatar-ring" [class.ai-ring]="post.isAiGenerated" [class.human-ring]="!post.isAiGenerated">
            <img [src]="post.author.avatarUrl" [alt]="'Avatar of ' + post.author.name" class="avatar" />
          </div>
          <div class="author-info">
            <div class="author-name-row">
              <span class="author-name">{{ post.author.name }}</span>
              @if (post.author.isVerified) {
              <span class="verified-badge" aria-label="Verified account">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </span>
              }
              @if (post.isAiGenerated) {
              <span class="ai-author-badge">AI</span>
              }
              @if (post.analysisRequested) {
              <app-analysis-status [status]="post.analysisStatus" />
              }
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
            @if (showMoreMenu()) {
            <div class="more-menu-backdrop" (click)="showMoreMenu.set(false)"></div>
            }
            @if (showMoreMenu()) {
            <div class="more-dropdown" role="menu" aria-label="Post options">
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
            }
          </div>
        </div>
      </header>

      <!-- Post Content -->
      <div class="post-content">
        <p class="content-text">{{ post.content }}</p>
        @if (post.imageUrl) {
        <img [src]="post.imageUrl" [alt]="'Image posted by ' + post.author.name" class="post-image" loading="lazy" />
        }
      </div>

      <!-- AI Likelihood Indicator Strip -->
      <div class="ai-likelihood-strip" [class]="'likelihood-' + getAiLikelihood()" role="status"
           [attr.aria-label]="'AI likelihood: ' + (getAiLikelihood() === 'ai' ? 'Looks AI-Generated' : getAiLikelihood() === 'human' ? 'Looks Human-Made' : 'Disputed')">
        @if (getAiLikelihood() === 'ai') {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/></svg>
        }
        @if (getAiLikelihood() === 'human') {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        }
        @if (getAiLikelihood() === 'disputed') {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        }
        <span class="lk-label">
          {{ getAiLikelihood() === 'ai' ? 'Looks AI-Generated' : getAiLikelihood() === 'human' ? 'Looks Human-Made' : 'Disputed · Mixed Signals' }}
        </span>
        <span class="lk-votes">{{ post.aiGeneratedFeedback.flaggedAsAi + post.aiGeneratedFeedback.flaggedAsHuman }} votes</span>
        <span class="lk-pill" [style.background]="confidence.color">{{ confidence.level }}</span>
      </div>

      <!-- Provenance Indicators -->
      @if (post.provenance?.length) {
      <div class="provenance-section" role="region" aria-label="Provenance indicators">
        <div class="provenance-header">
          <span class="provenance-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Provenance Indicators
          </span>
          <span class="provenance-note">Neutral evidence — not a judgment</span>
        </div>
        <div class="provenance-indicators">
          @for (p of post.provenance; track $index) {
          <div class="provenance-item" [class]="'prov-' + p.source">
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
          }
        </div>
      </div>
      }

      <!-- Expert Escalation -->
      @let ee = post.expertEscalation;
      @if (ee && ee.escalated) {
      <div class="expert-escalation" [class]="'risk-' + ee.riskLevel" role="alert">
        <div class="escalation-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span class="escalation-title">Expert Review {{ ee.expertVerdict ? 'Complete' : 'Pending' }}</span>
          <span class="risk-badge">{{ ee.riskLevel | uppercase }} RISK</span>
        </div>
        <p class="escalation-reason">{{ ee.reason }}</p>
        @if (ee.expertVerdict) {
        <p class="expert-verdict">
          Expert finding: {{ ee.expertVerdict }}
        </p>
        }
      </div>
      }

      <!-- AI Content Trust & Recommended Flag Section -->
      @let tr = trustResult();
      @if (tr) {
      <div class="trust-section" role="region" aria-label="AI Content Trust Score">
        <div class="trust-header">
          <div class="trust-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span class="trust-title">Content Trust Analysis</span>
            <span class="trust-label-badge" [class]="getLabelBadgeClass(tr.detection.recommendedLabel)">
              {{ tr.detection.recommendedLabel }}
            </span>
          </div>
          <button class="trust-toggle" (click)="showTrustDetails.set(!showTrustDetails())" [attr.aria-expanded]="showTrustDetails()">
            {{ showTrustDetails() ? 'Less' : 'Details' }}
          </button>
        </div>

        <!-- Trust score bar -->
        <div class="trust-score-bar-wrap">
          <div class="trust-score-number" [style.color]="getTrustScoreColor(tr.detection.trustScore)">
            {{ tr.detection.trustScore | number:'1.0-0' }}
          </div>
          <div class="trust-bar-track">
            <div class="trust-bar-fill" [style.width.%]="tr.detection.trustScore" [style.background]="getTrustScoreColor(tr.detection.trustScore)"></div>
          </div>
          <span class="trust-score-label">Trust Score</span>
        </div>

        <!-- Recommended Flag Button -->
        @if (tr.detection.recommendedLabel === 'likely-ai' || tr.detection.recommendedLabel === 'ai-generated') {
        <div class="recommended-flag">
          <div class="flag-recommendation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-notice)" stroke-width="2.5" aria-hidden="true">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            <span>Recommended: Flag or report this as <strong>"AI Content"</strong></span>
          </div>
          <button class="flag-ai-btn" (click)="flagAsAiContent()" [disabled]="flagSubmitting()" aria-label="Flag as AI Content">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/>
            </svg>
            {{ flagSubmitting() ? 'Flagging...' : 'Flag as AI Content' }}
          </button>
        </div>
        }

        <!-- Detection breakdown (expanded) -->
        @if (showTrustDetails()) {
        <div class="trust-details">
          <div class="signal-breakdown" role="group" aria-label="Detection signal breakdown">
            <div class="signal-bar-item">
              <span class="signal-name">Linguistic</span>
              <div class="signal-track"><div class="signal-fill" [style.width.%]="tr.detection.linguisticScore * 100" style="background: var(--accent-primary)"></div></div>
              <span class="signal-val">{{ tr.detection.linguisticScore | number:'1.0-0' }}%</span>
            </div>
            <div class="signal-bar-item">
              <span class="signal-name">Structural</span>
              <div class="signal-track"><div class="signal-fill" [style.width.%]="tr.detection.structuralScore * 100" style="background: var(--accent-secondary)"></div></div>
              <span class="signal-val">{{ tr.detection.structuralScore | number:'1.0-0' }}%</span>
            </div>
            <div class="signal-bar-item">
              <span class="signal-name">Statistical</span>
              <div class="signal-track"><div class="signal-fill" [style.width.%]="tr.detection.statisticalScore * 100" style="background: var(--status-notice)"></div></div>
              <span class="signal-val">{{ tr.detection.statisticalScore | number:'1.0-0' }}%</span>
            </div>
            <div class="signal-bar-item">
              <span class="signal-name">Community</span>
              <div class="signal-track"><div class="signal-fill" [style.width.%]="tr.detection.communityScore * 100" style="background: var(--status-confirm)"></div></div>
              <span class="signal-val">{{ tr.detection.communityScore | number:'1.0-0' }}%</span>
            </div>
          </div>

          <!-- Signals list -->
          @if (tr.detection.signals.length) {
          <div class="trust-signals">
            <span class="signals-title">Detection Signals</span>
            <ul class="signals-list">
              @for (sig of tr.detection.signals; track $index) {
              <li>{{ sig }}</li>
              }
            </ul>
          </div>
          }

          <!-- Risk factors -->
          @if (tr.detection.riskFactors.length) {
          <div class="trust-risks">
            <span class="risks-title">Risk Factors</span>
            <div class="risk-tags">
              @for (risk of tr.detection.riskFactors; track $index) {
              <span class="risk-tag">{{ risk }}</span>
              }
            </div>
          </div>
          }

          <!-- Corrective actions -->
          @if (tr.corrections.actions.length) {
          <div class="trust-corrections">
            <div class="corrections-header">
              <span class="corrections-title">Corrective Actions</span>
              <span class="risk-level-badge" [class]="'risk-' + tr.corrections.overallRisk">
                {{ tr.corrections.overallRisk | uppercase }} RISK
              </span>
            </div>
            <div class="corrections-list">
              @for (action of tr.corrections.actions; track $index) {
              <div class="correction-item" [class]="'correction-' + action.severity">
                <span class="correction-icon">{{ getCategoryIcon(action.category) }}</span>
                <div class="correction-body">
                  <span class="correction-title">{{ action.title }}</span>
                  <span class="correction-desc">{{ action.description }}</span>
                </div>
                <span class="correction-severity">{{ action.severity }}</span>
              </div>
              }
            </div>
          </div>
          }

          <!-- AI detection recommendation -->
          <div class="trust-recommendation">
            <p>{{ tr.detection.recommendation }}</p>
          </div>
        </div>
        }
      </div>
      }

      <!-- Bias Analysis Results -->
      @if (post.biasResult) {
      <div class="bias-results-section" role="region" aria-label="Bias analysis results">
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
        @if (post.biasResult.favoritismFlag) {
        <div class="bias-meta">
          <span class="meta-item">Δ {{ post.biasResult.biasDelta | number:'1.3-3' }}</span>
          <span class="meta-item">{{ post.biasResult.favoredRegion }}</span>
          <span class="meta-item">{{ post.biasResult.dominantBiasedAgent }}</span>
        </div>
        }
        @if (post.biasResult.explanationSummary) {
        <div class="bias-explanation">
          <p>{{ post.biasResult.explanationSummary }}</p>
        </div>
        }
        <div class="report-row">
          <app-report-export [postId]="post.id" />
        </div>
      </div>
      }

      <!-- Regional Agent Verdicts -->
      @if (post.agentScores?.length) {
      <div class="agent-verdicts-section" role="region" aria-label="Regional agent verdicts">
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

        @if (showAgents()) {
        <div class="agent-grid">
          @for (agent of post.agentScores; track agent.agentName) {
          <div
            class="agent-card"
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
            @if (agent.biasHighlights.length) {
            <div class="agent-highlights">
              @for (h of agent.biasHighlights; track $index) {
              <span class="highlight-tag">{{ h }}</span>
              }
            </div>
            }
          </div>
          }
        </div>
        }

        <!-- Bias Detection Summary -->
        @if (post.biasDetection) {
        <div class="bias-detection-summary">
          <div class="detection-header">
            <span class="detection-label">Bias Detection</span>
            <span class="detection-level" [class]="'level-' + post.biasDetection.overallBiasLevel">
              {{ post.biasDetection.overallBiasLevel | uppercase }}
            </span>
          </div>
          <p class="detection-summary">{{ post.biasDetection.summary }}</p>
          @if (post.biasDetection.flaggedItems.length) {
          <div class="flagged-items">
            @for (item of post.biasDetection.flaggedItems; track $index) {
            <div class="flagged-item">
              <div class="flagged-item-header">
                <span class="flagged-agent">{{ getRegionFlag(item.region) }} {{ item.agentName }}</span>
                <span class="flagged-mode" [class]="'mode-' + item.biasMode.toLowerCase()">{{ item.biasMode }}</span>
                <span class="flagged-severity" [class]="'severity-' + item.severity">{{ item.severity }}</span>
              </div>
              <span class="flagged-delta">Δ {{ item.deltaFromBaseline | number:'1.3-3' }}</span>
              <p class="flagged-explanation">{{ item.explanation }}</p>
            </div>
            }
          </div>
          }
        </div>
        }
      </div>
      }

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

    /* ── AI Content Trust Section ────────────────────────────────────────── */

    .trust-section {
      margin: var(--space-4) var(--space-4) 0;
      padding: var(--space-4);
      background: var(--bg-tertiary, rgba(88,166,255,0.04));
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg, 10px);
    }

    .trust-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3, 0.75rem);
    }

    .trust-title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .trust-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .trust-label-badge {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 8px;
      border-radius: 8px;
    }

    .label-ai, .label-likely-ai { color: #fff; background: var(--status-critical, #f85149); }
    .label-uncertain { color: var(--status-notice, #d4a054); background: rgba(212,160,84,0.15); }
    .label-likely-human, .label-human { color: var(--status-confirm, #2ea043); background: rgba(46,160,67,0.12); }

    .trust-toggle {
      font-size: 0.75rem;
      color: var(--accent-primary, #58a6ff);
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 6px;
    }

    .trust-toggle:hover { text-decoration: underline; }

    .trust-score-bar-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: var(--space-3, 0.75rem);
    }

    .trust-score-number {
      font-size: 1.5rem;
      font-weight: 800;
      min-width: 48px;
      text-align: center;
    }

    .trust-bar-track {
      flex: 1;
      height: 8px;
      background: var(--surface-secondary, #0d1117);
      border-radius: 4px;
      overflow: hidden;
    }

    .trust-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.4s ease;
    }

    .trust-score-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    /* Recommended Flag */
    .recommended-flag {
      padding: 0.625rem 0.75rem;
      background: rgba(212,160,84,0.08);
      border: 1px solid rgba(212,160,84,0.25);
      border-radius: 8px;
      margin-bottom: var(--space-3, 0.75rem);
    }

    .flag-recommendation {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.825rem;
      color: var(--text-secondary, #c9d1d9);
      margin-bottom: 0.5rem;
    }

    .flag-recommendation strong {
      color: var(--status-notice, #d4a054);
    }

    .flag-ai-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 1rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #fff;
      background: var(--status-critical, #f85149);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }

    .flag-ai-btn:hover:not(:disabled) { background: #da3633; transform: translateY(-1px); }
    .flag-ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Signal breakdown */
    .signal-breakdown {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-bottom: var(--space-3, 0.75rem);
    }

    .signal-bar-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .signal-name {
      font-size: 0.75rem;
      color: var(--text-muted);
      min-width: 72px;
    }

    .signal-track {
      flex: 1;
      height: 5px;
      background: var(--surface-secondary, #0d1117);
      border-radius: 3px;
      overflow: hidden;
    }

    .signal-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .signal-val {
      font-size: 0.7rem;
      color: var(--text-muted);
      min-width: 32px;
      text-align: right;
    }

    /* Signals list */
    .trust-signals, .trust-risks { margin-bottom: var(--space-3, 0.75rem); }
    .signals-title, .risks-title, .corrections-title {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 0.375rem;
    }

    .signals-list {
      margin: 0;
      padding-left: 1.25rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .risk-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; }
    .risk-tag {
      font-size: 0.7rem;
      color: var(--status-critical, #f85149);
      background: rgba(248,81,73,0.08);
      border: 1px solid rgba(248,81,73,0.2);
      padding: 2px 8px;
      border-radius: 4px;
    }

    /* Corrective actions */
    .corrections-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .risk-level-badge {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 8px;
    }

    .risk-level-badge.risk-critical, .risk-level-badge.risk-high { color: #fff; background: var(--status-critical); }
    .risk-level-badge.risk-medium { color: var(--status-notice); background: rgba(212,160,84,0.15); }
    .risk-level-badge.risk-low { color: var(--status-confirm); background: rgba(46,160,67,0.12); }

    .corrections-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: var(--space-3, 0.75rem);
    }

    .correction-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.5rem 0.625rem;
      background: var(--surface-secondary, #0d1117);
      border-radius: 6px;
      border-left: 3px solid var(--border-default);
    }

    .correction-item.correction-required { border-left-color: var(--status-critical, #f85149); }
    .correction-item.correction-recommended { border-left-color: var(--status-notice, #d4a054); }
    .correction-item.correction-advisory { border-left-color: var(--accent-primary, #58a6ff); }
    .correction-item.correction-info { border-left-color: var(--text-muted); }

    .correction-icon { font-size: 0.9rem; margin-top: 1px; }

    .correction-body { flex: 1; }
    .correction-title {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .correction-desc {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.4;
      margin-top: 2px;
    }
    .correction-severity {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .trust-recommendation {
      padding: 0.5rem 0.75rem;
      background: rgba(88,166,255,0.06);
      border-radius: 6px;
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .trust-recommendation p { margin: 0; }
  `]
})
export class PostCardComponent implements OnInit {
  @Input({ required: true }) post!: Post;

  private postService = inject(PostService);
  private exposureTracker = inject(ExposureTrackerService);
  private aiFlagService = inject(AiFlagService);
  showDetails = signal(false);
  showAgents = signal(false);
  showMoreMenu = signal(false);
  notifyEnabled = signal(false);
  trustResult = signal<ContentTrustResult | null>(null);
  showTrustDetails = signal(false);
  flagSubmitting = signal(false);

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
    // Load content trust analysis
    this.aiFlagService.getContentTrust(this.post.id).subscribe(result => {
      this.trustResult.set(result);
    });
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

  /** Flag this content as AI-generated with the AI flag service. */
  flagAsAiContent(): void {
    this.flagSubmitting.set(true);
    this.aiFlagService.flagContent({
      postId: this.post.id,
      flagType: 'ai',
      reason: 'Recommended flag based on AI detection analysis',
      confidence: 4,
    }).subscribe(() => {
      this.flagSubmitting.set(false);
      this.voteAi();
      // Refresh trust result
      this.aiFlagService.getContentTrust(this.post.id).subscribe(r => this.trustResult.set(r));
    });
  }

  /** Flag as misleading content. */
  flagAsMisleading(): void {
    this.flagSubmitting.set(true);
    this.aiFlagService.flagContent({
      postId: this.post.id,
      flagType: 'misleading',
      reason: 'User flagged as misleading',
      confidence: 3,
    }).subscribe(() => {
      this.flagSubmitting.set(false);
    });
  }

  getTrustScoreColor(score: number): string {
    if (score >= 80) return 'var(--status-confirm, #2ea043)';
    if (score >= 60) return 'var(--accent-primary, #58a6ff)';
    if (score >= 40) return 'var(--status-notice, #d4a054)';
    return 'var(--status-critical, #f85149)';
  }

  getLabelBadgeClass(label: string): string {
    switch (label) {
      case 'ai-generated': return 'label-ai';
      case 'likely-ai': return 'label-likely-ai';
      case 'uncertain': return 'label-uncertain';
      case 'likely-human': return 'label-likely-human';
      case 'human': return 'label-human';
      default: return 'label-uncertain';
    }
  }

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'labeling': return '🏷️';
      case 'suppression': return '🔇';
      case 'transparency': return '👁️';
      case 'escalation': return '⚠️';
      case 'education': return '📚';
      default: return '📋';
    }
  }
}

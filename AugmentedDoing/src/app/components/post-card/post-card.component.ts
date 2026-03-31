import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Post } from '../../models/post.model';
import { PostService } from '../../services/post.service';
import { ExposureTrackerService } from '../../services/exposure-tracker.service';
import { AnalysisStatusComponent } from '../analysis-status/analysis-status.component';
import { BiasDetailsModalComponent } from '../bias-details-modal/bias-details-modal.component';
import { ReportExportComponent } from '../report-export/report-export.component';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, UpperCasePipe, AnalysisStatusComponent, BiasDetailsModalComponent, ReportExportComponent],
  template: `
    <article class="post-card" [class.ai-generated]="post.isAiGenerated" [class.bias-flagged]="post.biasResult?.favoritismFlag" [class.ai-analyzed]="post.aiAnalyzed">
      <!-- AI Generated Badge -->
      <div class="ai-status-banner" *ngIf="post.isAiGenerated">
        <span class="ai-icon">🤖</span>
        <span class="ai-text">Author declared: AI-Generated Content</span>
      </div>

      <!-- AI Analysis Notification Banner — notifies humans this content was analyzed by AI -->
      <div class="ai-notification-banner" *ngIf="post.aiAnalyzed">
        <div class="ai-notif-icon-area">
          <span class="ai-notif-pulse"></span>
          <span class="ai-notif-icon">🧠</span>
        </div>
        <div class="ai-notif-body">
          <span class="ai-notif-title">AI Multi-Agent Analysis Complete</span>
          <span class="ai-notif-sub">This content was analyzed by 5 regional AI bias agents + 1 baseline agent using PyTorch, HuggingFace Transformers &amp; OpenCV</span>
        </div>
        <span class="ai-notif-badge" [class]="'severity-' + (post.biasDetection?.overallBiasLevel ?? 'low')">
          {{ post.biasDetection?.overallBiasLevel ?? 'analyzed' | uppercase }}
        </span>
      </div>

      <!-- Favoritism Warning Badge -->
      <div class="bias-warning-banner" *ngIf="post.biasResult?.favoritismFlag">
        <span class="bias-icon">🚩</span>
        <span class="bias-text">Bias Favoritism Detected — {{ post.biasResult!.dominantBiasedAgent }} → {{ post.biasResult!.favoredRegion }}</span>
        <span class="bias-deducted">Deducted: {{ post.biasResult!.deductedBiasAmount | number:'1.3-3' }}</span>
      </div>

      <!-- Post Header -->
      <header class="post-header">
        <div class="author-section">
          <img [src]="post.author.avatarUrl" [alt]="post.author.name" class="avatar" />
          <div class="author-info">
            <div class="author-name-row">
              <span class="author-name">{{ post.author.name }}</span>
              <span class="verified-badge" *ngIf="post.author.isVerified">✓</span>
              <span class="ai-author-badge" *ngIf="post.isAiGenerated">AI</span>
              <app-analysis-status [status]="post.analysisStatus" *ngIf="post.analysisRequested" />
            </div>
            <span class="author-username">&#64;{{ post.author.username }} · {{ post.createdAt | date:'shortTime' }} · {{ post.contentType }}</span>
          </div>
        </div>
      </header>

      <!-- Post Content -->
      <div class="post-content">
        <p class="content-text">{{ post.content }}</p>
        <img *ngIf="post.imageUrl" [src]="post.imageUrl" alt="Post image" class="post-image" />
      </div>

      <!-- Provenance Indicators — neutral evidence about content origin (proposal §Idea) -->
      <div class="provenance-section" *ngIf="post.provenance?.length">
        <div class="provenance-header">
          <span class="provenance-title">🔐 Provenance Indicators</span>
          <span class="provenance-note">Neutral evidence — not a judgment</span>
        </div>
        <div class="provenance-indicators">
          <div class="provenance-item" *ngFor="let p of post.provenance" [class]="'prov-' + p.source">
            <span class="prov-icon">{{ getProvenanceIcon(p.source) }}</span>
            <div class="prov-body">
              <span class="prov-label">{{ p.label }}</span>
              <span class="prov-reasoning">{{ p.reasoning }}</span>
            </div>
            <div class="prov-confidence">
              <div class="prov-conf-bar"><div class="prov-conf-fill" [style.width.%]="p.confidence * 100"></div></div>
              <span class="prov-conf-text">{{ p.confidence * 100 | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Expert Escalation — high-risk content flagged for expert review (proposal §Overview) -->
      <div class="expert-escalation" *ngIf="post.expertEscalation?.escalated" [class]="'risk-' + post.expertEscalation!.riskLevel">
        <div class="escalation-header">
          <span class="escalation-icon">⚠️</span>
          <span class="escalation-title">Expert Review {{ post.expertEscalation!.expertVerdict ? 'Complete' : 'Pending' }}</span>
          <span class="risk-badge">{{ post.expertEscalation!.riskLevel | uppercase }} RISK</span>
        </div>
        <p class="escalation-reason">{{ post.expertEscalation!.reason }}</p>
        <p class="expert-verdict" *ngIf="post.expertEscalation!.expertVerdict">
          Expert finding: {{ post.expertEscalation!.expertVerdict }}
        </p>
      </div>

      <!-- Bias Analysis Results (3 views) -->
      <div class="bias-results-section" *ngIf="post.biasResult">
        <div class="bias-results-header">
          <span class="results-title">📊 Bias Analysis (Simulated)</span>
          <button class="details-btn" (click)="showDetails.set(true)">View Details</button>
        </div>
        <div class="score-cards">
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
          <span class="meta-item">🌍 {{ post.biasResult.favoredRegion }}</span>
          <span class="meta-item">🤖 {{ post.biasResult.dominantBiasedAgent }}</span>
        </div>
        <div class="bias-explanation" *ngIf="post.biasResult.explanationSummary">
          <p>{{ post.biasResult.explanationSummary }}</p>
        </div>
        <div class="report-row">
          <app-report-export [postId]="post.id" />
        </div>
      </div>

      <!-- Regional Agent Verdicts — injected content from all biased agents -->
      <div class="agent-verdicts-section" *ngIf="post.agentScores?.length">
        <div class="agent-verdicts-header">
          <span class="verdicts-title">🌍 Regional Agent Verdicts</span>
          <button class="toggle-agents-btn" (click)="showAgents.set(!showAgents())">
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
              <span class="agent-region-flag">{{ getRegionFlag(agent.region) }}</span>
              <span class="agent-name">{{ agent.region ?? 'Baseline' }}</span>
              <span class="agent-score" [style.color]="getScoreColor(agent.score)">{{ agent.score | number:'1.2-2' }}</span>
            </div>
            <div class="agent-confidence">
              <div class="conf-bar"><div class="conf-fill" [style.width.%]="agent.confidence * 100"></div></div>
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
      <div class="ai-verification-section">
        <div class="verification-header">
          <span class="verification-title">🔍 Community Verification</span>
          <div class="confidence-badge" [style.background]="confidence.color">
            {{ confidence.level }}
          </div>
        </div>

        <div class="verification-stats">
          <div class="stat-bar">
            <div class="stat-fill ai-fill" [style.width.%]="getAiPercentage()"></div>
            <div class="stat-fill human-fill" [style.width.%]="getHumanPercentage()"></div>
          </div>
          <div class="stat-labels">
            <span class="stat-label ai-label">
              🤖 {{ post.aiGeneratedFeedback.flaggedAsAi }} think AI
            </span>
            <span class="stat-label human-label">
              👤 {{ post.aiGeneratedFeedback.flaggedAsHuman }} think Human
            </span>
          </div>
        </div>

        <div class="vote-section">
          <span class="vote-prompt">What do you think?</span>
          <div class="vote-buttons">
            <button
              class="vote-btn ai-vote"
              [class.active]="post.aiGeneratedFeedback.userVote === 'ai'"
              (click)="voteAi()"
            >
              <span class="vote-icon">🤖</span>
              <span class="vote-text">Looks AI</span>
            </button>
            <button
              class="vote-btn human-vote"
              [class.active]="post.aiGeneratedFeedback.userVote === 'human'"
              (click)="voteHuman()"
            >
              <span class="vote-icon">👤</span>
              <span class="vote-text">Looks Human</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Post Actions -->
      <footer class="post-footer">
        <button class="action-btn like-btn" (click)="likePost()">
          <span class="action-icon">❤️</span>
          <span class="action-count">{{ post.likes }}</span>
        </button>
        <button class="action-btn comment-btn">
          <span class="action-icon">💬</span>
          <span class="action-count">{{ post.comments.length }}</span>
        </button>
        <button class="action-btn share-btn">
          <span class="action-icon">🔗</span>
          <span class="action-text">Share</span>
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
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      }

      &.ai-generated {
        border: 1px solid rgba(233, 30, 99, 0.3);
      }

      &.bias-flagged {
        border: 1px solid rgba(255, 152, 0, 0.4);
        box-shadow: 0 8px 32px rgba(255, 152, 0, 0.1);
      }
    }

    .ai-status-banner {
      background: linear-gradient(135deg, rgba(233, 30, 99, 0.15), rgba(156, 39, 176, 0.15));
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid rgba(233, 30, 99, 0.2);

      .ai-icon { font-size: 1.25rem; }
      .ai-text { font-size: 0.8rem; color: #e91e63; font-weight: 500; }
    }

    .bias-warning-banner {
      background: linear-gradient(135deg, rgba(255,152,0,0.15), rgba(255,109,0,0.15));
      padding: 0.6rem 1.5rem; display: flex; align-items: center; gap: 0.75rem;
      border-bottom: 1px solid rgba(255,152,0,0.2);
      .bias-icon { font-size: 1.1rem; }
      .bias-text { font-size: 0.78rem; color: #ff9800; font-weight: 500; flex: 1; }
      .bias-deducted {
        font-size: 0.7rem; background: rgba(255,152,0,0.2); color: #ffb74d;
        padding: 0.2rem 0.6rem; border-radius: 10px; font-weight: 600;
      }
    }

    .post-header {
      padding: 1.25rem 1.5rem;
    }

    .author-section {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.1);
    }

    .author-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .author-name-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .author-name {
      font-weight: 600;
      color: #e6e6e6;
      font-size: 1rem;
    }

    .verified-badge {
      background: #1d9bf0;
      color: white;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
    }

    .ai-author-badge {
      background: linear-gradient(135deg, #e91e63, #9c27b0);
      color: white;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.625rem;
      font-weight: 700;
    }

    .author-username {
      font-size: 0.875rem;
      color: #8892b0;
    }

    .post-content {
      padding: 0 1.5rem;
    }

    .content-text {
      color: #ccd6f6;
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 0 1rem;
    }

    .post-image {
      width: 100%;
      border-radius: 12px;
      margin-bottom: 1rem;
      max-height: 400px;
      object-fit: cover;
    }

    .ai-verification-section {
      margin: 1rem 1.5rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .verification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .verification-title {
      font-size: 0.875rem;
      color: #8892b0;
      font-weight: 500;
    }

    .confidence-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
    }

    .verification-stats {
      margin-bottom: 1rem;
    }

    .stat-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      display: flex;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .stat-fill {
      height: 100%;
      transition: width 0.5s ease;
    }

    .ai-fill {
      background: linear-gradient(135deg, #e91e63, #9c27b0);
    }

    .human-fill {
      background: linear-gradient(135deg, #4caf50, #8bc34a);
    }

    .stat-labels {
      display: flex;
      justify-content: space-between;
    }

    .stat-label {
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .ai-label {
      color: #e91e63;
    }

    .human-label {
      color: #4caf50;
    }

    .vote-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .vote-prompt {
      font-size: 0.8rem;
      color: #8892b0;
    }

    .vote-buttons {
      display: flex;
      gap: 0.5rem;
    }

    .vote-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      color: #8892b0;
      font-size: 0.8rem;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      &.ai-vote.active {
        background: linear-gradient(135deg, #e91e63, #9c27b0);
        color: white;
        border-color: transparent;
      }

      &.human-vote.active {
        background: linear-gradient(135deg, #4caf50, #8bc34a);
        color: white;
        border-color: transparent;
      }

      .vote-icon {
        font-size: 1rem;
      }
    }

    .post-footer {
      padding: 1rem 1.5rem;
      display: flex;
      gap: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .action-btn {
      background: transparent;
      border: none;
      color: #8892b0;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 8px;
      transition: all 0.3s ease;
      font-size: 0.9rem;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ccd6f6;
      }

      .action-icon {
        font-size: 1.1rem;
      }
    }

    .like-btn:hover {
      color: #ff6b6b;
    }

    /* Bias results section */
    .bias-results-section {
      margin: 0.75rem 1.5rem; padding: 1rem;
      background: linear-gradient(135deg, rgba(0,217,255,0.04), rgba(0,255,136,0.02));
      border-radius: 12px; border: 1px solid rgba(0,217,255,0.1);
    }
    .bias-results-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;
    }
    .results-title { font-size: 0.85rem; color: #8892b0; font-weight: 500; }
    .details-btn {
      background: rgba(0,217,255,0.1); border: 1px solid rgba(0,217,255,0.2);
      color: #00d9ff; padding: 0.3rem 0.75rem; border-radius: 16px;
      cursor: pointer; font-size: 0.7rem; transition: all 0.3s;
      &:hover { background: rgba(0,217,255,0.2); }
    }
    .score-cards {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.5rem;
    }
    .score-card {
      text-align: center; padding: 0.7rem 0.5rem; border-radius: 10px;
      .score-label { display: block; font-size: 0.65rem; color: #8892b0; margin-bottom: 0.25rem; }
      .score-value { display: block; font-size: 1.2rem; font-weight: 700; }
      &.raw { background: rgba(233,30,99,0.08); .score-value { color: #e91e63; } }
      &.baseline { background: rgba(158,158,158,0.08); .score-value { color: #ccd6f6; } }
      &.debiased { background: rgba(0,217,255,0.08); .score-value { color: #00d9ff; } }
    }
    .bias-meta {
      display: flex; gap: 0.75rem; flex-wrap: wrap; margin: 0.5rem 0;
      .meta-item { font-size: 0.72rem; color: #ff9800; background: rgba(255,152,0,0.1);
        padding: 0.2rem 0.6rem; border-radius: 10px; }
    }
    .bias-explanation {
      margin-top: 0.5rem; padding: 0.5rem 0.75rem;
      border-left: 3px solid #00d9ff; background: rgba(0,217,255,0.03); border-radius: 0 6px 6px 0;
      p { margin: 0; font-size: 0.75rem; color: #8892b0; line-height: 1.5; }
    }
    .report-row { margin-top: 0.5rem; display: flex; justify-content: flex-end; }

    /* AI Analysis Notification Banner */
    .ai-notification-banner {
      background: linear-gradient(135deg, rgba(0,217,255,0.10), rgba(156,39,176,0.08));
      padding: 0.7rem 1.5rem; display: flex; align-items: center; gap: 0.75rem;
      border-bottom: 1px solid rgba(0,217,255,0.15);
    }
    .ai-notif-icon-area { position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
    .ai-notif-pulse {
      position: absolute; width: 32px; height: 32px; border-radius: 50%;
      background: rgba(0,217,255,0.2); animation: notifPulse 2s ease-in-out infinite;
    }
    @keyframes notifPulse { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.4); opacity: 0; } }
    .ai-notif-icon { font-size: 1.3rem; z-index: 1; }
    .ai-notif-body { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; }
    .ai-notif-title { font-size: 0.8rem; font-weight: 600; color: #00d9ff; }
    .ai-notif-sub { font-size: 0.68rem; color: #8892b0; }
    .ai-notif-badge {
      font-size: 0.6rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 10px;
      text-transform: uppercase; letter-spacing: 0.5px;
      &.severity-low { background: rgba(76,175,80,0.2); color: #4caf50; }
      &.severity-medium { background: rgba(255,152,0,0.2); color: #ff9800; }
      &.severity-high { background: rgba(233,30,99,0.2); color: #e91e63; }
      &.severity-critical { background: rgba(244,67,54,0.25); color: #f44336; }
      &.severity-analyzed { background: rgba(0,217,255,0.15); color: #00d9ff; }
    }

    /* AI-analyzed border glow */
    .post-card.ai-analyzed { border: 1px solid rgba(0,217,255,0.15); }

    /* Provenance Indicators */
    .provenance-section {
      margin: 0.75rem 1.5rem; padding: 0.75rem;
      background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);
    }
    .provenance-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .provenance-title { font-size: 0.8rem; color: #8892b0; font-weight: 500; }
    .provenance-note { font-size: 0.62rem; color: #5a6480; font-style: italic; }
    .provenance-indicators { display: flex; flex-direction: column; gap: 0.4rem; }
    .provenance-item {
      display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.6rem;
      border-radius: 8px; background: rgba(255,255,255,0.02);
    }
    .prov-icon { font-size: 1rem; flex-shrink: 0; }
    .prov-body { flex: 1; display: flex; flex-direction: column; }
    .prov-label { font-size: 0.72rem; color: #ccd6f6; font-weight: 500; }
    .prov-reasoning { font-size: 0.65rem; color: #8892b0; }
    .prov-confidence { display: flex; align-items: center; gap: 0.4rem; min-width: 70px; }
    .prov-conf-bar { height: 4px; flex: 1; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
    .prov-conf-fill { height: 100%; background: #00d9ff; border-radius: 2px; }
    .prov-conf-text { font-size: 0.6rem; color: #8892b0; }

    /* Expert Escalation */
    .expert-escalation {
      margin: 0.5rem 1.5rem; padding: 0.75rem 1rem; border-radius: 10px;
      &.risk-low { background: rgba(76,175,80,0.06); border: 1px solid rgba(76,175,80,0.15); }
      &.risk-medium { background: rgba(255,152,0,0.06); border: 1px solid rgba(255,152,0,0.15); }
      &.risk-high { background: rgba(233,30,99,0.06); border: 1px solid rgba(233,30,99,0.15); }
      &.risk-critical { background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.2); }
    }
    .escalation-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
    .escalation-icon { font-size: 1.1rem; }
    .escalation-title { font-size: 0.8rem; color: #e6e6e6; font-weight: 600; flex: 1; }
    .risk-badge {
      font-size: 0.6rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 8px;
      background: rgba(244,67,54,0.15); color: #f44336; letter-spacing: 0.5px;
    }
    .escalation-reason { margin: 0 0 0.3rem; font-size: 0.72rem; color: #8892b0; }
    .expert-verdict {
      margin: 0; padding: 0.4rem 0.6rem; font-size: 0.75rem; color: #ccd6f6;
      background: rgba(0,217,255,0.05); border-left: 3px solid #00d9ff; border-radius: 0 6px 6px 0;
    }

    /* Agent Verdicts */
    .agent-verdicts-section {
      margin: 0.75rem 1.5rem; padding: 0.75rem;
      background: linear-gradient(135deg, rgba(156,39,176,0.04), rgba(0,217,255,0.03));
      border-radius: 12px; border: 1px solid rgba(156,39,176,0.1);
    }
    .agent-verdicts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .verdicts-title { font-size: 0.85rem; color: #8892b0; font-weight: 500; }
    .toggle-agents-btn {
      background: rgba(156,39,176,0.1); border: 1px solid rgba(156,39,176,0.2);
      color: #ce93d8; padding: 0.25rem 0.6rem; border-radius: 12px;
      cursor: pointer; font-size: 0.65rem; transition: all 0.3s;
      &:hover { background: rgba(156,39,176,0.2); }
    }
    .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.6rem; margin-bottom: 0.75rem; }
    .agent-card {
      padding: 0.65rem; border-radius: 10px; background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s;
      &.highest-bias { border-color: rgba(233,30,99,0.3); background: rgba(233,30,99,0.04); }
      &.lowest-bias { border-color: rgba(76,175,80,0.3); background: rgba(76,175,80,0.04); }
    }
    .agent-card-header { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem; }
    .agent-region-flag { font-size: 1.1rem; }
    .agent-name { font-size: 0.75rem; color: #ccd6f6; font-weight: 600; flex: 1; }
    .agent-score { font-size: 1rem; font-weight: 700; }
    .agent-confidence { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem; }
    .conf-bar { height: 3px; flex: 1; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
    .conf-fill { height: 100%; background: linear-gradient(90deg, #00d9ff, #4caf50); border-radius: 2px; }
    .conf-label { font-size: 0.6rem; color: #8892b0; }
    .agent-reasoning { margin: 0 0 0.3rem; font-size: 0.65rem; color: #8892b0; line-height: 1.4; }
    .agent-highlights { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .highlight-tag {
      font-size: 0.55rem; padding: 0.1rem 0.4rem; border-radius: 6px;
      background: rgba(255,152,0,0.1); color: #ffb74d; white-space: nowrap;
    }

    /* Bias Detection Summary */
    .bias-detection-summary {
      padding: 0.65rem; background: rgba(255,255,255,0.02); border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .detection-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; }
    .detection-label { font-size: 0.75rem; color: #8892b0; font-weight: 500; flex: 1; }
    .detection-level {
      font-size: 0.6rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 8px;
      &.level-low { background: rgba(76,175,80,0.15); color: #4caf50; }
      &.level-medium { background: rgba(255,152,0,0.15); color: #ff9800; }
      &.level-high { background: rgba(233,30,99,0.15); color: #e91e63; }
      &.level-critical { background: rgba(244,67,54,0.2); color: #f44336; }
    }
    .detection-summary { margin: 0 0 0.4rem; font-size: 0.7rem; color: #8892b0; line-height: 1.5; }
    .flagged-items { display: flex; flex-direction: column; gap: 0.4rem; }
    .flagged-item {
      padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 6px;
      border-left: 3px solid rgba(255,152,0,0.4);
    }
    .flagged-item-header { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; flex-wrap: wrap; }
    .flagged-agent { font-size: 0.7rem; color: #ccd6f6; font-weight: 500; }
    .flagged-mode {
      font-size: 0.55rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px;
      &.mode-inflation { background: rgba(233,30,99,0.15); color: #e91e63; }
      &.mode-deflation { background: rgba(33,150,243,0.15); color: #2196f3; }
      &.mode-selective { background: rgba(255,152,0,0.15); color: #ff9800; }
      &.mode-neutral { background: rgba(158,158,158,0.15); color: #9e9e9e; }
    }
    .flagged-severity {
      font-size: 0.55rem; font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 4px;
      &.severity-negligible { background: rgba(158,158,158,0.12); color: #9e9e9e; }
      &.severity-low { background: rgba(76,175,80,0.12); color: #4caf50; }
      &.severity-medium { background: rgba(255,152,0,0.12); color: #ff9800; }
      &.severity-high { background: rgba(233,30,99,0.12); color: #e91e63; }
      &.severity-critical { background: rgba(244,67,54,0.15); color: #f44336; }
    }
    .flagged-delta { font-size: 0.62rem; color: #ff9800; }
    .flagged-explanation { margin: 0.2rem 0 0; font-size: 0.62rem; color: #8892b0; line-height: 1.4; }

    @media (max-width: 480px) {
      .vote-section {
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
      }

      .vote-buttons {
        width: 100%;
      }

      .vote-btn {
        flex: 1;
        justify-content: center;
      }
    }
  `]
})
export class PostCardComponent implements OnInit {
  @Input({ required: true }) post!: Post;

  private postService = inject(PostService);
  private exposureTracker = inject(ExposureTrackerService);
  showDetails = signal(false);
  showAgents = signal(false);

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
    if (score >= 0.8) return '#f44336';
    if (score >= 0.6) return '#ff9800';
    if (score >= 0.4) return '#ffeb3b';
    return '#4caf50';
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

  likePost(): void {
    this.postService.likePost(this.post.id);
  }
}

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../services/post.service';
import { AnalysisService } from '../../services/analysis.service';
import { ContentModality } from '../../models/post.model';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="create-post-card">
      <div class="create-post-header">
        <img [src]="currentUser.avatarUrl" [alt]="currentUser.name" class="avatar" />
        <div class="user-info">
          <span class="user-name">{{ currentUser.name }}</span>
          <span class="username">&#64;{{ currentUser.username }}</span>
        </div>
      </div>

      <div class="create-post-body">
        <!-- Content Type Selector -->
        <div class="content-type-section">
          <span class="section-label">Content Type:</span>
          <div class="type-buttons">
            <button *ngFor="let t of contentTypes"
              class="type-btn" [class.active]="selectedContentType() === t.value"
              (click)="selectedContentType.set(t.value)">
              <span>{{ t.icon }}</span> {{ t.label }}
            </button>
          </div>
        </div>

        <textarea
          [(ngModel)]="postContent"
          placeholder="What's on your mind? Share your thoughts..."
          class="post-input"
          rows="3"
        ></textarea>

        <!-- File / URL input -->
        <div class="media-section" *ngIf="selectedContentType() !== 'text'">
          <input
            type="text"
            [(ngModel)]="mediaUrl"
            [placeholder]="selectedContentType() === 'image' ? 'Image URL or local file path' : 'Video URL or local file path'"
            class="image-input"
          />
        </div>

        <div class="ai-toggle-section">
          <div class="ai-toggle">
            <label class="toggle-label">
              <span class="toggle-icon">{{ isAiGenerated() ? '🤖' : '👤' }}</span>
              <span class="toggle-text">
                {{ isAiGenerated() ? 'This content is AI-generated' : 'This is human-created content' }}
              </span>
            </label>
            <button
              class="toggle-btn"
              [class.ai-active]="isAiGenerated()"
              (click)="toggleAiGenerated()"
            >
              <span class="toggle-slider"></span>
            </button>
          </div>
          <p class="ai-toggle-hint">
            {{ isAiGenerated()
              ? '✨ Thank you for being transparent! Your post will be marked as AI-generated.'
              : '💡 Toggle this if your content was created or assisted by AI tools.' }}
          </p>
        </div>

        <!-- Bias Analysis Toggles -->
        <div class="analysis-toggles">
          <div class="toggle-row">
            <label class="mini-toggle">
              <input type="checkbox" [checked]="runAnalysis()" (change)="runAnalysis.set(!runAnalysis())" />
              <span class="mini-track"><span class="mini-thumb"></span></span>
              <span>🔬 Run Bias Analysis</span>
            </label>
          </div>
          <div class="toggle-row" *ngIf="runAnalysis()">
            <label class="mini-toggle">
              <input type="checkbox" [checked]="compareBaseline()" (change)="compareBaseline.set(!compareBaseline())" />
              <span class="mini-track"><span class="mini-thumb"></span></span>
              <span>📏 Compare With Non-Bias Agent</span>
            </label>
          </div>
          <div class="toggle-row" *ngIf="runAnalysis()">
            <label class="mini-toggle">
              <input type="checkbox" [checked]="showDebiased()" (change)="showDebiased.set(!showDebiased())" />
              <span class="mini-track"><span class="mini-thumb"></span></span>
              <span>✅ Show Debiased Result</span>
            </label>
          </div>
          <div class="analysis-status-indicator" *ngIf="analysisRunning()">
            <span class="spinner"></span> Analyzing...
          </div>
        </div>
      </div>

      <div class="create-post-footer">
        <div class="post-actions-left">
          <button class="action-btn" (click)="toggleImageInput()" *ngIf="selectedContentType() === 'text'">
            <span>🖼️</span> Add Image
          </button>
        </div>
        <button
          class="post-btn"
          [disabled]="!postContent.trim()"
          (click)="submitPost()"
        >
          <span class="btn-icon">✨</span>
          Post
        </button>
      </div>
    </div>
  `,
  styles: [`
    .create-post-card {
      background: linear-gradient(145deg, #1e1e2e, #252538);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .create-post-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid #00d9ff;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 600;
      color: #e6e6e6;
    }

    .username {
      font-size: 0.875rem;
      color: #8892b0;
    }

    .create-post-body {
      margin-bottom: 1rem;
    }

    .post-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1rem;
      color: #e6e6e6;
      font-size: 1rem;
      resize: none;
      transition: all 0.3s ease;

      &:focus {
        outline: none;
        border-color: #00d9ff;
        box-shadow: 0 0 0 3px rgba(0, 217, 255, 0.1);
      }

      &::placeholder {
        color: #6b7280;
      }
    }

    .ai-toggle-section {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .ai-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
    }

    .toggle-icon {
      font-size: 1.5rem;
    }

    .toggle-text {
      font-size: 0.9rem;
      color: #ccd6f6;
      font-weight: 500;
    }

    .toggle-btn {
      position: relative;
      width: 56px;
      height: 28px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.3s ease;

      &.ai-active {
        background: linear-gradient(135deg, #e91e63, #9c27b0);
      }

      .toggle-slider {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        background: white;
        border-radius: 50%;
        transition: all 0.3s ease;
      }

      &.ai-active .toggle-slider {
        left: 31px;
      }
    }

    .ai-toggle-hint {
      margin: 0.75rem 0 0;
      font-size: 0.8rem;
      color: #8892b0;
      line-height: 1.4;
    }

    .image-url-section {
      margin-top: 1rem;
    }

    .image-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0.75rem;
      color: #e6e6e6;
      font-size: 0.875rem;

      &:focus {
        outline: none;
        border-color: #00d9ff;
      }

      &::placeholder {
        color: #6b7280;
      }
    }

    .create-post-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .post-actions-left {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #8892b0;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ccd6f6;
      }
    }

    .post-btn {
      background: linear-gradient(135deg, #00d9ff, #00ff88);
      border: none;
      color: #0a0a0f;
      padding: 0.75rem 2rem;
      border-radius: 25px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-icon {
        font-size: 1rem;
      }
    }

    /* Content type section */
    .content-type-section {
      display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;
    }
    .section-label { font-size: 0.85rem; color: #8892b0; font-weight: 500; }
    .type-buttons { display: flex; gap: 0.5rem; }
    .type-btn {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      color: #8892b0; padding: 0.4rem 0.9rem; border-radius: 20px; cursor: pointer;
      display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem;
      transition: all 0.3s ease;
      &:hover { background: rgba(255,255,255,0.1); }
      &.active { background: linear-gradient(135deg, #00d9ff, #00ff88); color: #0a0a0f; font-weight: 600; border-color: transparent; }
    }
    .media-section { margin-top: 0.75rem; }

    /* Analysis toggles */
    .analysis-toggles {
      margin-top: 1rem; padding: 0.75rem; background: rgba(0,217,255,0.03);
      border-radius: 10px; border: 1px solid rgba(0,217,255,0.1);
    }
    .toggle-row {
      padding: 0.35rem 0;
    }
    .mini-toggle {
      display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.85rem; color: #ccd6f6;
      input { display: none; }
    }
    .mini-track {
      width: 36px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 10px;
      position: relative; transition: all 0.3s; flex-shrink: 0;
    }
    .mini-thumb {
      position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
      background: #6b7280; border-radius: 50%; transition: all 0.3s;
    }
    .mini-toggle input:checked + .mini-track {
      background: linear-gradient(135deg, #00d9ff, #00ff88);
    }
    .mini-toggle input:checked + .mini-track .mini-thumb {
      left: 18px; background: white;
    }
    .analysis-status-indicator {
      display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;
      font-size: 0.8rem; color: #00d9ff;
    }
    .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(0,217,255,0.3);
      border-top-color: #00d9ff; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class CreatePostComponent {
  private postService = inject(PostService);
  private analysisService = inject(AnalysisService);

  currentUser = this.postService.getCurrentUser();
  postContent = '';
  imageUrl = '';
  mediaUrl = '';
  isAiGenerated = signal(false);
  showImageInput = signal(false);
  selectedContentType = signal<ContentModality>('text');
  runAnalysis = signal(false);
  compareBaseline = signal(true);
  showDebiased = signal(true);
  analysisRunning = signal(false);

  contentTypes = [
    { value: 'text' as const, label: 'Text', icon: '📝' },
    { value: 'image' as const, label: 'Image', icon: '🖼️' },
    { value: 'video' as const, label: 'Video', icon: '🎬' },
  ];

  toggleAiGenerated(): void {
    this.isAiGenerated.update(v => !v);
  }

  toggleImageInput(): void {
    this.showImageInput.update(v => !v);
    if (!this.showImageInput()) {
      this.imageUrl = '';
    }
  }

  submitPost(): void {
    if (this.postContent.trim()) {
      const ct = this.selectedContentType();
      const img = ct === 'image' ? (this.mediaUrl.trim() || this.imageUrl.trim() || undefined) : (this.imageUrl.trim() || undefined);
      const doAnalysis = this.runAnalysis();

      this.postService.createPost(
        this.postContent.trim(),
        this.isAiGenerated(),
        img,
        ct,
        doAnalysis,
      );

      if (doAnalysis) {
        const postId = this.postService.getAllPosts()[0]?.id;
        if (postId) {
          this.analysisRunning.set(true);
          this.postService.updatePostAnalysis(postId, 'running');
          this.analysisService.analyze({
            postId,
            contentType: ct,
            content: this.postContent.trim(),
            mediaUrl: this.mediaUrl.trim() || undefined,
          }).subscribe({
            next: (result) => {
              this.postService.updatePostAnalysis(postId, 'completed', {
                rawBiasedScore: result.rawBiasedScore,
                baselineNonbiasedScore: result.baselineNonbiasedScore,
                debiasedAdjustedScore: result.debiasedAdjustedScore,
                biasDelta: result.biasDelta,
                deductedBiasAmount: result.deductedBiasAmount,
                biasAmplificationIndex: result.biasAmplificationIndex,
                disagreementRate: result.disagreementRate,
                regionDominanceScore: result.regionDominanceScore,
                favoritismFlag: result.favoritismFlag,
                dominantBiasedAgent: result.dominantBiasedAgent,
                favoredRegion: result.favoredRegion,
                favoredSegments: result.favoredSegments,
                explanationSummary: result.explanationSummary,
                reportPath: result.reportPath,
              });
              this.analysisRunning.set(false);
            },
            error: () => {
              this.postService.updatePostAnalysis(postId, 'failed');
              this.analysisRunning.set(false);
            }
          });
        }
      }

      this.postContent = '';
      this.imageUrl = '';
      this.mediaUrl = '';
      this.isAiGenerated.set(false);
      this.showImageInput.set(false);
      this.runAnalysis.set(false);
    }
  }
}

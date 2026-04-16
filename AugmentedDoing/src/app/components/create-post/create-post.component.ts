import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../services/post.service';
import { AnalysisService } from '../../services/analysis.service';
import { ContentModality } from '../../models/post.model';
import { IconComponent, IconName } from '../icon/icon.component';
import { ImgFallbackDirective } from '../../utils/img-fallback.directive';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ImgFallbackDirective],
  template: `
    <div class="create-post-card card-glass">
      <!-- Header -->
      <div class="create-post-header">
        <div class="author-row">
          <img [src]="currentUser.avatarUrl" [alt]="currentUser.name" class="avatar" appImgFallback="avatar" />
          <div class="author-details">
            <span class="author-name">{{ currentUser.name }}</span>
            <span class="author-username">&#64;{{ currentUser.username }}</span>
          </div>
        </div>
        <div class="progress-indicator" [attr.aria-label]="'Form completion: ' + completionPercent() + ' percent'">
          <div class="progress-bar" [style.width.%]="completionPercent()"></div>
        </div>
      </div>

      <form (ngSubmit)="submitPost()" (keydown.enter)="handleKeydown($event)" class="create-post-form">
        <!-- Content Type Selector -->
        <fieldset class="form-group">
          <legend class="form-label">Content Type *</legend>
          <div class="segmented-buttons" role="radiogroup" aria-label="Select content type">
            @for (t of contentTypes; track t.value) {
              <button 
                type="button"
                class="seg-btn" 
                [class.active]="selectedContentType() === t.value"
                [class.disabled]="postContent().trim().length === 0"
                (click)="selectedContentType.set(t.value)"
                role="radio" 
                [attr.aria-checked]="selectedContentType() === t.value"
                [attr.aria-label]="t.label + ' - ' + (postContent().trim().length === 0 ? 'write content first' : 'available')">
                <app-icon [name]="t.icon" [size]="18" />
                <span>{{ t.label }}</span>
              </button>
            }
          </div>
        </fieldset>

        <!-- Content Input -->
        <fieldset class="form-group">
          <label for="post-content" class="form-label">
            What's on your mind? *
            <span class="char-count" [class.warning]="postContent().length > 270" [class.max]="postContent().length >= 280">
              {{ postContent().length }}<span class="char-max">/280</span>
            </span>
          </label>
          <textarea
            id="post-content"
            [ngModel]="postContent()"
            (ngModelChange)="postContent.set($event)"
            name="postContent"
            placeholder="Share your thoughts, observations, or content analysis..."
            class="form-textarea"
            [class.filled]="postContent().trim().length > 0"
            [class.error]="postContent().trim().length === 0 && submitAttempted()"
            rows="3"
            maxlength="280"
            (focus)="contentFocused.set(true)"
            (blur)="contentFocused.set(false)"
            aria-label="Post content"
            aria-required="true"
          ></textarea>
          @if (postContent().trim().length === 0 && submitAttempted()) {
            <span class="field-error" role="alert">
              <app-icon name="warning" [size]="14" />
              Content is required
            </span>
          }
          @if (postContent().length >= 250) {
            <span class="field-hint">{{ 280 - postContent().length }} characters remaining</span>
          }
        </fieldset>

        <!-- Media Input (conditional) -->
        @if (selectedContentType() !== 'text') {
          <fieldset class="form-group">
            <label for="media-url" class="form-label">
              {{ selectedContentType() === 'image' ? 'Image URL' : 'Video URL' }}
              @if (selectedContentType() !== 'text') { <span class="required" aria-label="required">*</span> }
            </label>
            <input
              id="media-url"
              type="url"
              [ngModel]="mediaUrl()"
              (ngModelChange)="mediaUrl.set($event)"
              name="mediaUrl"
              [placeholder]="selectedContentType() === 'image' ? 'https://example.com/image.jpg' : 'https://example.com/video.mp4'"
              class="form-input"
              [class.filled]="mediaUrl().trim().length > 0"
              [class.error]="isMediaFieldInvalid()"
              (focus)="mediaFocused.set(true)"
              (blur)="mediaFocused.set(false)"
              [attr.aria-label]="selectedContentType() === 'image' ? 'Image URL' : 'Video URL'"
            />
            @if (isMediaFieldInvalid()) {
              <span class="field-error" role="alert">
                <app-icon name="warning" [size]="14" />
                {{ selectedContentType() === 'image' ? 'Image' : 'Video' }} URL is required
              </span>
            }
            <span class="field-hint">{{ selectedContentType() === 'image' ? 'PNG, JPG, WebP' : 'MP4, WebM, Ogg' }} • Max 50MB</span>
          </fieldset>
        }

        <!-- AI Toggle Section -->
        <div class="media-section" *ngIf="showImageInput() && selectedContentType() === 'text'">
          <label [for]="'inline-image-url'" class="sr-only">Image URL</label>
          <input
            id="inline-image-url"
            type="text"
            [ngModel]="imageUrl()"
            (ngModelChange)="imageUrl.set($event)"
            [placeholder]="'Image URL or local file path'"
            class="media-input"
          />
        </div>

        <div class="ai-toggle-section">
          <div class="ai-toggle">
            <label class="toggle-label" for="ai-toggle-btn">
              <app-icon [name]="isAiGenerated() ? 'ai-robot' : 'human'" [size]="20" />
              <span class="toggle-text">
                {{ isAiGenerated() ? 'This content is AI-generated' : 'This is human-created content' }}
              </span>
            </label>
            <button
              id="ai-toggle-btn"
              class="toggle-btn"
              [class.ai-active]="isAiGenerated()"
              (click)="toggleAiGenerated()"
              role="switch"
              [attr.aria-checked]="isAiGenerated()"
              aria-label="Toggle AI-generated declaration"
            >
              <span class="toggle-slider"></span>
            </button>
          </div>
          <p class="ai-toggle-hint" role="status">
            {{ isAiGenerated()
              ? 'Thank you for being transparent! Your post will be marked as AI-generated.'
              : 'Toggle this if your content was created or assisted by AI tools.' }}
          </p>
        </div>

        <!-- Bias Analysis Toggles -->
        <div class="analysis-toggles">
          <div class="toggle-row">
            <label class="mini-toggle">
              <input type="checkbox" [checked]="runAnalysis()" (change)="runAnalysis.set(!runAnalysis())" />
              <span class="mini-track"><span class="mini-thumb"></span></span>
              <app-icon name="search" [size]="14" />
              <span>Run Bias Analysis</span>
            </label>
          </div>
          @if (runAnalysis()) {
            <div class="toggle-row">
              <label class="mini-toggle">
                <input type="checkbox" [checked]="compareBaseline()" (change)="compareBaseline.set(!compareBaseline())" />
                <span class="mini-track"><span class="mini-thumb"></span></span>
                <app-icon name="target" [size]="14" />
                <span>Compare With Non-Bias Agent</span>
              </label>
            </div>
            <div class="toggle-row">
              <label class="mini-toggle">
                <input type="checkbox" [checked]="showDebiased()" (change)="showDebiased.set(!showDebiased())" />
                <span class="mini-track"><span class="mini-thumb"></span></span>
                <app-icon name="verified" [size]="14" />
                <span>Show Debiased Result</span>
              </label>
            </div>
          }
          @if (analysisRunning()) {
            <div class="analysis-status-indicator" role="status" aria-live="polite">
              <span class="spinner" aria-hidden="true"></span> Analyzing...
            </div>
          }
        </div>
      </form>

      <div class="create-post-footer">
        <div class="post-actions-left">
          @if (selectedContentType() === 'text') {
            <button class="action-btn" (click)="toggleImageInput()">
              <app-icon name="image" [size]="16" /> Add Image
            </button>
          }
        </div>
        <button
          class="post-btn btn-primary"
          [disabled]="!postContent().trim()"
          (click)="submitPost()"
        >
          <app-icon name="send" [size]="16" />
          Post
        </button>
      </div>
    </div>
  `,
  styles: [`
    .create-post-card {
      margin-bottom: var(--space-6);
      padding: var(--space-6);
    }

    .create-post-header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid var(--accent-cyan);
    }

    .user-info { display: flex; flex-direction: column; }
    .user-name { font-weight: 600; color: var(--text-primary); }
    .username { font-size: var(--text-sm); color: var(--text-muted); }

    .post-input {
      width: 100%;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      color: var(--text-primary);
      font-size: var(--text-base);
      resize: none;
      transition: border-color var(--transition-fast);

      &:focus {
        outline: none;
        border-color: var(--accent-cyan);
        box-shadow: 0 0 0 3px rgba(57, 210, 192, 0.15);
      }

      &::placeholder { color: var(--text-muted); }
    }

    .ai-toggle-section {
      margin-top: var(--space-4);
      padding: var(--space-4);
      background: var(--bg-elevated);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }

    .ai-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      cursor: pointer;
    }

    .toggle-text {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      font-weight: 500;
    }

    .toggle-btn {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      background: var(--bg-hover);
      border: 1.5px solid var(--border-default);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
      flex-shrink: 0;
      padding: 0;
      appearance: none;
      -webkit-appearance: none;
      vertical-align: middle;

      &:hover {
        border-color: var(--text-muted);
        background: var(--bg-elevated);
      }

      &.ai-active {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
      }

      .toggle-slider {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background: var(--text-muted);
        border-radius: 50%;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        pointer-events: none;
      }

      &.ai-active .toggle-slider {
        transform: translateX(20px);
        background: #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      }

      &:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 2px;
      }
    }

    .ai-toggle-hint {
      margin: var(--space-3) 0 0;
      font-size: var(--text-xs);
      color: var(--text-muted);
      line-height: 1.4;
    }

    .media-input {
      width: 100%;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      color: var(--text-primary);
      font-size: var(--text-sm);
      margin-top: var(--space-3);

      &:focus { outline: none; border-color: var(--accent-cyan); }
      &::placeholder { color: var(--text-muted); }
    }

    .create-post-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
      margin-top: var(--space-4);
    }

    .post-actions-left { display: flex; gap: var(--space-2); }

    .action-btn {
      background: transparent;
      border: 1px solid var(--border-default);
      color: var(--text-muted);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      transition: all var(--transition-fast);

      &:hover { background: var(--bg-hover); color: var(--text-primary); }
    }

    .post-btn {
      padding: var(--space-3) var(--space-8);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* Content type section */
    .content-type-section {
      border: none;
      padding: 0;
      margin: 0 0 var(--space-4);
    }
    .section-label {
      font-size: var(--text-sm);
      color: var(--text-muted);
      font-weight: 500;
      margin-bottom: var(--space-2);
      display: block;
    }
    .type-buttons { display: flex; gap: var(--space-2); }
    .type-btn {
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      transition: all var(--transition-fast);
      &:hover { background: var(--bg-hover); }
      &.active {
        background: var(--info-bg);
        color: var(--accent-blue);
        border-color: rgba(88, 166, 255, 0.3);
        font-weight: 600;
      }
    }

    /* Analysis toggles */
    .analysis-toggles {
      margin-top: var(--space-4);
      padding: var(--space-4);
      background: var(--bg-elevated);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
    }
    .toggle-row { padding: var(--space-2) 0; }
    .mini-toggle {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      cursor: pointer;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      input { display: none; }
    }
    .mini-track {
      width: 36px; height: 20px;
      background: var(--bg-hover);
      border-radius: var(--radius-full);
      position: relative;
      transition: all var(--transition-fast);
      flex-shrink: 0;
      border: 1px solid var(--border-default);
    }
    .mini-thumb {
      position: absolute; top: 2px; left: 2px;
      width: 14px; height: 14px;
      background: var(--text-muted);
      border-radius: 50%;
      transition: all var(--transition-fast);
    }
    .mini-toggle input:checked + .mini-track {
      background: var(--accent-cyan);
      border-color: var(--accent-cyan);
    }
    .mini-toggle input:checked + .mini-track .mini-thumb {
      left: 18px;
      background: white;
    }
    .analysis-status-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-2);
      font-size: var(--text-sm);
      color: var(--accent-cyan);
    }
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(57, 210, 192, 0.3);
      border-top-color: var(--accent-cyan);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (forced-colors: active) {
      .toggle-btn { border: 2px solid ButtonText; }
      .type-btn.active { outline: 2px solid Highlight; }
    }
  `]
})
export class CreatePostComponent {
  private postService = inject(PostService);
  private analysisService = inject(AnalysisService);

  currentUser = this.postService.getCurrentUser();
  postContent = signal('');
  imageUrl = signal('');
  mediaUrl = signal('');
  contentFocused = signal(false);
  mediaFocused = signal(false);
  submitAttempted = signal(false);
  isAiGenerated = signal(false);
  showImageInput = signal(false);
  selectedContentType = signal<ContentModality>('text');
  runAnalysis = signal(false);
  compareBaseline = signal(true);
  showDebiased = signal(true);
  analysisRunning = signal(false);
  completionPercent = computed(() => {
    const content = this.postContent().trim().length > 0 ? 50 : 0;
    const mediaRequired = this.selectedContentType() !== 'text';
    const media = mediaRequired ? (this.mediaUrl().trim().length > 0 ? 30 : 0) : 30;
    const aiFlag = 20;
    return content + media + aiFlag;
  });

  contentTypes: { value: 'text' | 'image' | 'video'; label: string; icon: IconName }[] = [
    { value: 'text', label: 'Text', icon: 'text' },
    { value: 'image', label: 'Image', icon: 'image' },
    { value: 'video', label: 'Video', icon: 'video' },
  ];

  toggleAiGenerated(): void {
    this.isAiGenerated.update(v => !v);
  }

  toggleImageInput(): void {
    this.showImageInput.update(v => !v);
    if (!this.showImageInput()) {
      this.imageUrl.set('');
    }
  }

  handleKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key === 'Enter') {
      this.submitPost();
    }
  }

  isMediaFieldInvalid(): boolean {
    return this.selectedContentType() !== 'text' && this.submitAttempted() && this.mediaUrl().trim().length === 0;
  }

  submitPost(): void {
    this.submitAttempted.set(true);

    if (this.postContent().trim()) {
      const ct = this.selectedContentType();
      const img = ct === 'image'
        ? (this.mediaUrl().trim() || this.imageUrl().trim() || undefined)
        : (this.imageUrl().trim() || undefined);
      const doAnalysis = this.runAnalysis();

      if (ct !== 'text' && !this.mediaUrl().trim()) {
        return;
      }

      this.postService.createPost(
        this.postContent().trim(),
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
            content: this.postContent().trim(),
            mediaUrl: this.mediaUrl().trim() || undefined,
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

      this.postContent.set('');
      this.imageUrl.set('');
      this.mediaUrl.set('');
      this.isAiGenerated.set(false);
      this.showImageInput.set(false);
      this.runAnalysis.set(false);
      this.submitAttempted.set(false);
    }
  }
}

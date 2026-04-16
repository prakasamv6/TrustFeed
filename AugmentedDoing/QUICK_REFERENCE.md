/// ══════════════════════════════════════════════════════════════════════
/// QUICK REFERENCE GUIDE — CSS Classes & Usage Examples
/// ══════════════════════════════════════════════════════════════════════

# AugmentedDoing UI/UX — Quick Reference

## Dashboard Components

### Top Bar (Glass-Morphism)
```html
<div class="top-bar glass">
  <div class="brand">
    <img src="logo.svg" alt="Logo" />
    <span>AugmentedDoing</span>
  </div>
  
  <div class="top-bar-controls">
    <button class="icon-btn" title="Settings">⚙️</button>
    <button class="icon-btn" title="Help">❓</button>
    <button class="icon-btn" title="Profile">👤</button>
  </div>
</div>
```

### Tab Navigation
```html
<div class="tab-nav">
  <button class="tab-btn active">Overview</button>
  <button class="tab-btn">Analytics</button>  
  <button class="tab-btn">Bias Patterns</button>
  <button class="tab-btn">Agent Performance</button>
  <button class="tab-btn">Research Insights</button>
</div>
```

### KPI Strip (Responsive Grid)
```html
<div class="kpi-strip">
  <div class="kpi">
    <div class="kpi-value">1,284</div>
    <div class="kpi-label">Feed Analyses</div>
    <small class="kpi-source">Last 30 days</small>
  </div>
  <!-- Repeat for 6 metrics -->
</div>
```

**Responsive Behavior:**
- **Desktop (1200px+):** 6 columns
- **Tablet (768px-1199px):** 3 columns  
- **Mobile (<768px):** 2 columns

---

## Form Components

### Text Input with Label & Validation
```html
<div class="form-field">
  <input 
    type="text"
    class="form-input"
    id="content"
    placeholder="Enter content..."
    [class.error]="submitAttempted && !isValid()"
    (focus)="contentFocused.set(true)"
    (blur)="contentFocused.set(false)"
  />
  <label for="content">Content</label>
  
  <!-- Error message (shown when error state) -->
  <small class="field-error" *ngIf="submitAttempted && !isValid()">
    Content is required and must be 10+ characters
  </small>
  
  <!-- Hint text (shown by default) -->
  <small class="field-hint" *ngIf="!submitAttempted">
    Share your thoughts or attach media
  </small>
</div>
```

### Character Counter
```html
<div class="form-field">
  <textarea 
    class="form-textarea"
    maxlength="280"
    [value]="postContent()"
    (input)="postContent.set($event.target.value)"
  ></textarea>
  
  <div class="char-count" [class.warning]="count > 224" [class.max]="count === 280">
    <span>{{ postContent().length }} / 280</span>
  </div>
</div>
```

### Form Completion Progress
```html
<div class="form-field">
  <div class="label">Form Completion</div>
  <div class="progress-bar-lg">
    <div class="progress-fill" [style.width]="completionPercent() + '%'"></div>
  </div>
  <div class="progress-text">
    <span>{{ completionPercent() }}% Complete</span>
    <span class="progress-step">Step {{ currentStep() }} of 3</span>
  </div>
</div>
```

### Toggle Switch
```html
<div class="toggle-btn">
  <input 
    type="checkbox"
    id="ai-disclosure"
    [(ngModel)]="discloseAI"
    [checked]="discloseAI()"
  />
  <label for="ai-disclosure" class="toggle-slider"></label>
  <span>Disclose AI-Generated Content</span>
</div>
```

### Checkbox
```html
<div class="checkbox-row">
  <input 
    type="checkbox"
    id="consent"
    [(ngModel)]="agreedToTerms"
  />
  <label for="consent">I agree to the terms and conditions</label>
</div>
```

### Segmented Buttons (Content Type Select)
```html
<div class="segmented-buttons" role="group" aria-label="Content type">
  <button 
    class="seg-btn"
    [class.active]="contentType() === 'text'"
    (click)="contentType.set('text')"
  >
    📝 Text
  </button>
  <button 
    class="seg-btn"
    [class.active]="contentType() === 'image'"
    (click)="contentType.set('image')"
  >
    🖼️ Image
  </button>
  <button 
    class="seg-btn"
    [class.active]="contentType() === 'video'"
    (click)="contentType.set('video')"
  >
    🎥 Video
  </button>
</div>
```

---

## Button Styles & States

### Primary Button
```html
<button class="btn btn-primary">Submit</button>
<!-- Hover: -2px lift with shadow boost -->
<!-- Active: Immediate scale to 0.95 -->
```

### Secondary Button  
```html
<button class="btn btn-secondary">Cancel</button>
```

### Ghost Button (Outline)
```html
<button class="btn btn-ghost">View Details</button>
<!-- Hover: Background fills from left to right -->
```

### Icon Button
```html
<button class="icon-btn" aria-label="Delete">
  <span class="icon">🗑️</span>
</button>
<!-- Hover: Circular background appears with fade-in -->
```

### Button States
```html
<!-- Disabled -->
<button class="btn" disabled>Disabled Button</button>

<!-- Loading (custom) -->
<button class="btn" [disabled]="isLoading()">
  <span *ngIf="isLoading()" class="spinner-sm"></span>
  <span *ngIf="!isLoading()">Submit</span>
</button>
```

---

## Loading States

### Skeleton Screens

#### Text Skeleton
```html
<div class="skeleton-text long"></div>
<div class="skeleton-text short"></div>
```

#### KPI Card Skeleton
```html
<div class="kpi kpi-skeleton">
  <div class="skeleton-value"></div>
  <div class="skeleton-label"></div>
  <div class="skeleton-source"></div>
</div>
```

#### Post Card Skeleton
```html
<div class="post-card skeleton">
  <div class="post-header">
    <div class="avatar skeleton-circle"></div>
    <div>
      <div class="author-name skeleton-text"></div>
      <div class="author-username skeleton-text short"></div>
    </div>
  </div>
  <div class="post-body">
    <div class="post-content skeleton-text long"></div>
  </div>
  <div class="post-image skeleton-chart"></div>
</div>
```

#### Table Skeleton
```html
<table class="table-skeleton">
  <tbody>
    <tr *ngFor="let i of [1,2,3]">
      <td><div class="skeleton-cell"></div></td>
      <td><div class="skeleton-cell numeric"></div></td>
      <td><div class="skeleton-cell"></div></td>
    </tr>
  </tbody>
</table>
```

### Full Page Loading
```html
<ng-container *ngIf="isLoading$ | async">
  <div class="loading-indicator">
    <div class="spinner-lg"></div>
    <div class="loading-text">
      <span class="loading-dots">Loading</span>
    </div>
  </div>
</ng-container>
```

---

## Empty States

### Generic No Results
```html
<div class="empty-state">
  <div class="empty-state-icon">📭</div>
  <h3 class="empty-state-title">No Results Found</h3>
  <p class="empty-state-description">
    Try adjusting your filters or search terms.
  </p>
  <div class="empty-state-action">
    <button (click)="resetFilters()">Reset Filters</button>
  </div>
</div>
```

### Error State
```html
<div class="error-state">
  <div class="error-state-header">
    <span class="error-state-icon">⚠️</span>
    <span>Connection Error</span>
  </div>
  <p class="error-state-message">
    Unable to load your data. Check your connection and try again.
  </p>
  <div class="error-state-actions">
    <button class="retry" (click)="retry()">Retry</button>
    <button class="dismiss" (click)="dismiss()">Dismiss</button>
  </div>
</div>
```

### Coming Soon
```html
<div class="coming-soon">
  <span class="badge">COMING SOON</span>
  <div class="empty-state-icon">🚀</div>
  <h3 class="empty-state-title">Analytics Dashboard</h3>
  <p class="empty-state-description">
    Advanced analytics and reporting coming in Q2 2025.
  </p>
</div>
```

---

## Data Display Components

### Professional Table
```html
<table class="pro-table">
  <thead>
    <tr>
      <th>Post ID</th>
      <th>Bias Score</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let post of posts | slice:0:5">
      <td>{{ post.id }}</td>
      <td class="numeric">{{ post.bias | number:'1.2-2' }}</td>
      <td>
        <span class="badge" [class]="post.status">{{ post.status }}</span>
      </td>
    </tr>
  </tbody>
</table>
```

### Data Grid (Flexible Columns)
```html
<div class="data-grid">
  <div class="data-grid-header">
    <div class="grid-col">Date</div>
    <div class="grid-col">Analyses</div>
    <div class="grid-col">Avg Bias</div>
    <div class="grid-col">Trend</div>
  </div>
  <div class="data-grid-body">
    <div class="data-grid-row" *ngFor="let day of last7Days">
      <div class="grid-col">{{ day.date | date:'MMM dd' }}</div>
      <div class="grid-col numeric">{{ day.count }}</div>
      <div class="grid-col numeric">{{ day.avgBias | number:'1.1-1' }}</div>
      <div class="grid-col">
        <span class="trend-up" *ngIf="day.trend > 0">↑ {{ day.trend }}%</span>
        <span class="trend-down" *ngIf="day.trend < 0">↓ {{ day.trend }}%</span>
      </div>
    </div>
  </div>
</div>
```

---

## Animations

### Button Hover Animation
```html
<button class="btn">
  <!-- Automatically lifts on hover (-2px) -->
  Hover me
</button>
```

### Card Elevation
```html
<div class="card">
  <!-- Hover: -4px lift with shadow -->
  <h3>Card Title</h3>
  <p>Card content goes here.</p>
</div>
```

### Tab Active Indicator
```html
<button class="tab-btn active">
  <!-- Underline grows from left on active -->
  Active Tab
</button>
```

### Ripple Effect on Click
```html
<button class="btn btn-ripple">
  <!-- Radial ripple effect expands on click -->
  Click me
</button>
```

### Tooltip Animation
```html
<button class="tooltip" data-tooltip="Delete this item">
  <!-- Tooltip slides up on hover (prefers-reduced-motion: respect) -->
  🗑️
</button>
```

### Loading Spinner
```html
<div class="spinner-lg">
  <!-- Continuous rotation at 1s per revolution -->
</div>
```

### Pulse Effect
```html
<div class="pulse">
  <!-- Opacity 1→0.5→1 at 2s intervals -->
  Now Loading...
</div>
```

### Glow Effect
```html
<div class="glow">
  <!-- Box-shadow breathing animation -->
  Active Status
</div>
```

---

## Color & Status Indicators

### Status Badges
```html
<!-- Success -->
<span class="badge badge-success">✓ Verified</span>

<!-- Warning -->
<span class="badge badge-warning">⚠️ Pending</span>

<!-- Critical -->
<span class="badge badge-critical">❌ Error</span>

<!-- Info -->
<span class="badge badge-info">ℹ️ Info</span>
```

### Using CSS Variables
```scss
// Primary accent
color: var(--accent-primary);  // #3B82F6 (blue)

// Secondary shades
color: var(--accent-secondary);  // #8B5CF6 (purple)
color: var(--accent-cyan);       // #06B6D4
color: var(--accent-orange);     // #F97316
color: var(--accent-red);        // #EF4444
color: var(--accent-green);      // #10B981
```

---

## Spacing Reference

```html
<!-- 8px base unit system -->
<div style="margin: var(--space-1)">8px</div>
<div style="margin: var(--space-2)">16px</div>
<div style="margin: var(--space-3)">24px</div>
<div style="margin: var(--space-4)">32px</div>
<div style="margin: var(--space-5)">40px</div>
<div style="margin: var(--space-6)">48px</div>
<div style="margin: var(--space-7)">56px</div>
<div style="margin: var(--space-8)">64px</div>
```

---

## Typography Classes

```html
<!-- Font Sizes -->
<span style="font-size: var(--font-size-xs)">Extra small (10px)</span>
<span style="font-size: var(--font-size-sm)">Small (12px)</span>
<span style="font-size: var(--font-size-base)">Base (14px)</span>
<span style="font-size: var(--font-size-lg)">Large (16px)</span>
<span style="font-size: var(--font-size-xl)">XL (20px)</span>
<span style="font-size: var(--font-size-2xl)">2XL (24px)</span>

<!-- Text Colors -->
<p class="text-primary">Primary text</p>
<p class="text-secondary">Secondary text</p>
<p class="text-muted">Muted text (less prominent)</p>
<p class="text-critical">Critical/error text</p>
<p class="text-success">Success text</p>
```

---

## Responsive Breakpoints

```scss
@media (max-width: 1200px) {
  /* Large desktop adjustments */
}

@media (max-width: 768px) {
  /* Tablet adjustments */
  /* 3-col KPI grid → 2-col */
  /* Tables → stacked layout */
  /* Modal → full-screen */
}

@media (max-width: 640px) {
  /* Mobile adjustments */
  /* 2-col KPI grid → 1-col */
  /* Form fields → full width */
  /* Font sizes → smaller */
}
```

---

## Dark Mode Support

All components automatically support dark mode via CSS custom properties:

```scss
/* Light mode (default) */
background: var(--bg-primary);  /* white */
color: var(--text-primary);     /* near-black */

/* Dark mode (automatic) */
@media (prefers-color-scheme: dark) {
  background: var(--bg-primary);  /* near-black */
  color: var(--text-primary);     /* white */
}
```

Toggle in browser DevTools:
1. Open DevTools
2. Cmd/Ctrl + Shift + P → "Emulate CSS media feature prefers-color-scheme"
3. Select "dark" or "light"

---

## Accessibility

### Focus Indicators
All interactive elements show focus indicator on Tab:
```html
<button class="btn">Tab to me</button>
<!-- Shows 3px blue outline on focus -->
```

### Screen Reader Support
```html
<!-- Button with label -->
<button class="icon-btn" aria-label="Delete post">🗑️</button>

<!-- Form field with error -->
<input aria-invalid="true" aria-describedby="email-error" />
<small id="email-error" class="field-error">Invalid email format</small>

<!-- Loading state -->
<div role="status" aria-live="polite">
  <div class="spinner-lg"></div>
  <span>Loading reports...</span>
</div>
```

### Keyboard Navigation
- **Tab / Shift+Tab:** Move through elements
- **Enter / Space:** Activate buttons
- **Arrow Keys:** Navigate menus/tabs
- **Escape:** Close modals/dropdowns

### Motion Accessibility
```scss
/* Automatically disables animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Common Patterns

### Loading List
```html
<div class="feed-loading" *ngIf="isLoading$ | async">
  <app-post-card class="skeleton" *ngFor="let i of [1,2,3]"></app-post-card>
</div>

<div *ngIf="(posts$ | async) as posts">
  <app-post-card *ngFor="let post of posts" [post]="post"></app-post-card>
</div>

<app-empty-state 
  *ngIf="(posts$ | async)?.length === 0"
  icon="📭"
  title="No Posts"
  description="Create your first post to get started."
></app-empty-state>
```

### Form Submission Flow
```typescript
// Component
postForm = signal('');
submitAttempted = signal(false);
isSubmitting = signal(false);

onSubmit() {
  this.submitAttempted.set(true);
  if (!this.isFormValid()) return;
  
  this.isSubmitting.set(true);
  this.postService.create(this.postForm())
    .pipe(finalize(() => this.isSubmitting.set(false)))
    .subscribe(
      () => this.onSuccess(),
      (error) => this.onError(error)
    );
}
```

```html
<!-- Template -->
<form (ngSubmit)="onSubmit()">
  <div class="form-field">
    <textarea 
      class="form-textarea"
      [class.error]="submitAttempted() && !postForm()"
      [value]="postForm()"
      (input)="postForm.set($event.target.value)"
    ></textarea>
    <label>Content</label>
    <small class="field-error" *ngIf="submitAttempted() && !postForm()">
      Content is required
    </small>
  </div>
  
  <button 
    class="btn"
    [disabled]="isSubmitting()"
  >
    <span *ngIf="isSubmitting()" class="spinner-sm"></span>
    <span *ngIf="!isSubmitting()">Post</span>
  </button>
</form>
```

---

## Useful Tips

✅ **Do:**
- Use CSS custom properties (variables) instead of hardcoded colors
- Leverage flexbox/grid for responsive layouts
- Test dark mode with browser DevTools
- Add `aria-label` to icon-only buttons
- Use `trackBy` in *ngFor for performance

❌ **Don't:**
- Override CSS custom properties unnecessarily
- Disable focus indicators (accessibility violation)
- Use animations without respecting prefers-reduced-motion
- Hardcode colors or dimensions
- Forget to test on mobile devices

---

## Useful Resources

- **Animation Performance:** Use DevTools Performance tab (Ctrl+Shift+J)
- **Accessibility Testing:** NVDA (free screen reader)
- **Color Contrast:** WebAIM Contrast Checker
- **Responsive Design:** Chrome DevTools Device Mode
- **CSS Support:** Can I Use (caniuse.com)

---

**Last Updated:** 2024
**Version:** 1.0 Foundation Layer

import { Component, EventEmitter, Output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { AccessibilityService, ThemeMode, FontSize, AnimationLevel, LayoutDensity } from '../../services/accessibility.service';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [IconComponent],
  template: `
    <!-- Backdrop -->
    <div
      class="settings-backdrop"
      [class.active]="true"
      (click)="close.emit()"
      aria-hidden="true">
    </div>

    <!-- Panel -->
    <aside
      class="settings-panel"
      role="dialog"
      aria-labelledby="settings-title"
      aria-describedby="settings-desc"
      (keydown.escape)="close.emit()">

      <div class="settings-header">
        <div>
          <h2 id="settings-title" class="settings-title">
            <app-icon name="settings" [size]="20" />
            Preferences
          </h2>
          <p id="settings-desc" class="settings-subtitle">Customize your experience</p>
        </div>
        <button (click)="close.emit()" aria-label="Close settings" class="close-btn">
          <app-icon name="x-close" [size]="20" />
        </button>
      </div>

      <div class="settings-body">
        <!-- Theme -->
        <fieldset class="setting-group">
          <legend class="setting-label">
            <app-icon name="palette" [size]="16" />
            Theme
          </legend>
          <div class="option-row" role="radiogroup" aria-label="Theme selection">
            @for (opt of themeOptions; track opt.value) {
              <button
                class="option-btn"
                [class.active]="a11y.theme() === opt.value"
                role="radio"
                [attr.aria-checked]="a11y.theme() === opt.value"
                (click)="a11y.setTheme(opt.value)">
                <app-icon [name]="opt.icon" [size]="16" />
                {{ opt.label }}
              </button>
            }
          </div>
        </fieldset>

        <!-- Font Size -->
        <fieldset class="setting-group">
          <legend class="setting-label">
            <app-icon name="text" [size]="16" />
            Font Size
          </legend>
          <div class="option-row" role="radiogroup" aria-label="Font size selection">
            @for (opt of fontOptions; track opt.value) {
              <button
                class="option-btn"
                [class.active]="a11y.fontSize() === opt.value"
                role="radio"
                [attr.aria-checked]="a11y.fontSize() === opt.value"
                (click)="a11y.setFontSize(opt.value)">
                {{ opt.label }}
              </button>
            }
          </div>
        </fieldset>

        <!-- Animation Level -->
        <fieldset class="setting-group">
          <legend class="setting-label">
            <app-icon name="sparkles" [size]="16" />
            Animations
          </legend>
          <div class="option-row" role="radiogroup" aria-label="Animation level">
            @for (opt of animationOptions; track opt.value) {
              <button
                class="option-btn"
                [class.active]="a11y.animationLevel() === opt.value"
                role="radio"
                [attr.aria-checked]="a11y.animationLevel() === opt.value"
                (click)="a11y.setAnimationLevel(opt.value)">
                {{ opt.label }}
              </button>
            }
          </div>
        </fieldset>

        <!-- Layout Density -->
        <fieldset class="setting-group">
          <legend class="setting-label">
            <app-icon name="layout" [size]="16" />
            Layout Density
          </legend>
          <div class="option-row" role="radiogroup" aria-label="Layout density">
            @for (opt of densityOptions; track opt.value) {
              <button
                class="option-btn"
                [class.active]="a11y.density() === opt.value"
                role="radio"
                [attr.aria-checked]="a11y.density() === opt.value"
                (click)="a11y.setDensity(opt.value)">
                {{ opt.label }}
              </button>
            }
          </div>
        </fieldset>

        <!-- Info -->
        <div class="setting-info">
          <app-icon name="info" [size]="14" />
          <span>Settings are saved automatically and persist across sessions.</span>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .settings-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: var(--z-side-sheet);
      animation: fadeIn 0.2s ease-out;
    }

    .settings-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(400px, 90vw);
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-default);
      z-index: calc(var(--z-side-sheet) + 1);
      display: flex;
      flex-direction: column;
      animation: slideInRight 0.3s ease-out;
      overflow-y: auto;
    }

    .settings-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: var(--space-6);
      border-bottom: 1px solid var(--border-default);
    }

    .settings-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .settings-subtitle {
      font-size: var(--text-sm);
      color: var(--text-muted);
      margin-top: var(--space-1);
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .settings-body {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .setting-group {
      border: none;
      padding: 0;
      margin: 0;
    }

    .setting-label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: var(--space-3);
    }

    .option-row {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .option-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: 500;
      border: 1px solid var(--border-subtle);
      transition: all var(--transition-fast);
      min-height: var(--min-touch-target);

      &:hover {
        background: var(--bg-hover);
        border-color: var(--text-muted);
      }

      &.active {
        background: var(--info-bg);
        color: var(--accent-blue);
        border-color: var(--accent-blue);
      }
    }

    .setting-info {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      color: var(--text-muted);
      line-height: var(--leading-relaxed);

      app-icon { flex-shrink: 0; margin-top: 2px; }
    }

    @media (forced-colors: active) {
      .option-btn.active { border: 2px solid Highlight; }
    }
  `]
})
export class SettingsPanelComponent {
  @Output() close = new EventEmitter<void>();

  themeOptions: { value: ThemeMode; label: string; icon: any }[] = [
    { value: 'system', label: 'System', icon: 'settings' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'light', label: 'Light', icon: 'sun' },
  ];

  fontOptions: { value: FontSize; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ];

  animationOptions: { value: AnimationLevel; label: string }[] = [
    { value: 'full', label: 'Full' },
    { value: 'reduced', label: 'Reduced' },
    { value: 'none', label: 'None' },
  ];

  densityOptions: { value: LayoutDensity; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'spacious', label: 'Spacious' },
  ];

  constructor(public a11y: AccessibilityService) {}
}

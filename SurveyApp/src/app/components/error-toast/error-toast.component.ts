import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorNotificationService, AppError } from '../../services/error-notification.service';

@Component({
  selector: 'app-error-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" *ngIf="errorService.activeErrors().length > 0">
      <div *ngFor="let err of errorService.activeErrors()"
        class="toast" [class]="'toast-' + err.severity"
        role="alert" aria-live="polite">
        <div class="toast-header">
          <span class="toast-icon">{{ getIcon(err.severity) }}</span>
          <span class="toast-title">{{ err.title }}</span>
          <button class="toast-dismiss" (click)="errorService.dismiss(err.id)" aria-label="Dismiss">×</button>
        </div>
        <p class="toast-message">{{ err.message }}</p>
        <p class="toast-suggestion" *ngIf="err.suggestion">{{ err.suggestion }}</p>
        <div class="toast-actions" *ngIf="err.retryAction">
          <button class="toast-retry" (click)="retry(err)">Try Again</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 10000;
      display: flex; flex-direction: column; gap: 0.75rem;
      max-width: 420px; width: calc(100vw - 2rem);
    }
    .toast {
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-default); animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .toast-info { background: var(--status-info-bg); border-color: var(--status-info); }
    .toast-warning { background: var(--status-notice-bg); border-color: var(--status-notice); }
    .toast-error { background: var(--status-critical-bg); border-color: var(--status-critical); }
    .toast-critical { background: var(--status-critical-bg); border-color: var(--status-critical); }
    .toast-header {
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;
    }
    .toast-icon { font-size: 1.1rem; }
    .toast-title { flex: 1; font-weight: 600; font-size: 0.88rem; color: var(--text-primary); }
    .toast-dismiss {
      background: none; border: none; color: var(--text-muted); font-size: 1.2rem;
      cursor: pointer; padding: 0 0.25rem; line-height: 1; min-height: var(--min-touch-target);
      &:hover { color: var(--text-primary); }
    }
    .toast-message { margin: 0 0 0.3rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; }
    .toast-suggestion {
      margin: 0; font-size: 0.76rem; color: var(--text-muted); line-height: 1.5;
      font-style: italic;
    }
    .toast-actions { margin-top: 0.6rem; }
    .toast-retry {
      background: var(--bg-elevated); border: 1px solid var(--border-default);
      color: var(--text-secondary); padding: 0.35rem 1rem; border-radius: var(--radius-sm); cursor: pointer;
      font-size: 0.78rem; transition: background 0.2s; min-height: var(--min-touch-target);
      &:hover { background: var(--bg-hover); }
    }

    @media (forced-colors: active) {
      .toast { border: 2px solid CanvasText; }
    }
  `]
})
export class ErrorToastComponent {
  errorService = inject(ErrorNotificationService);

  getIcon(severity: string): string {
    switch (severity) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'critical': return '🚨';
      default: return '⚠️';
    }
  }

  retry(err: AppError): void {
    if (err.retryAction) {
      this.errorService.dismiss(err.id);
      err.retryAction();
    }
  }
}

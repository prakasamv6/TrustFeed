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
      border-radius: 12px; padding: 1rem 1.25rem; backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.1); animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .toast-info { background: rgba(33,150,243,0.12); border-color: rgba(33,150,243,0.3); }
    .toast-warning { background: rgba(255,152,0,0.12); border-color: rgba(255,152,0,0.3); }
    .toast-error { background: rgba(244,67,54,0.12); border-color: rgba(244,67,54,0.3); }
    .toast-critical { background: rgba(211,47,47,0.18); border-color: rgba(211,47,47,0.5); }
    .toast-header {
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;
    }
    .toast-icon { font-size: 1.1rem; }
    .toast-title { flex: 1; font-weight: 600; font-size: 0.88rem; color: #e6e6e6; }
    .toast-dismiss {
      background: none; border: none; color: #8892b0; font-size: 1.2rem;
      cursor: pointer; padding: 0 0.25rem; line-height: 1;
      &:hover { color: #e6e6e6; }
    }
    .toast-message { margin: 0 0 0.3rem; font-size: 0.82rem; color: #ccd6f6; line-height: 1.6; }
    .toast-suggestion {
      margin: 0; font-size: 0.76rem; color: #8892b0; line-height: 1.5;
      font-style: italic;
    }
    .toast-actions { margin-top: 0.6rem; }
    .toast-retry {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      color: #ccd6f6; padding: 0.35rem 1rem; border-radius: 8px; cursor: pointer;
      font-size: 0.78rem; transition: background 0.2s;
      &:hover { background: rgba(255,255,255,0.15); }
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

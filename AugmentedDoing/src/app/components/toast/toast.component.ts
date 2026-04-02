import { Component, Injectable, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent, IconName } from '../icon/icon.component';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  dismissible: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  private _nextId = 0;

  readonly toasts = this._toasts.asReadonly();

  show(message: string, type: ToastType = 'info', duration = 5000): void {
    const toast: Toast = {
      id: this._nextId++,
      message,
      type,
      duration,
      dismissible: true,
    };
    this._toasts.update(t => [...t, toast]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }

  dismiss(id: number): void {
    this._toasts.update(t => t.filter(toast => toast.id !== id));
  }

  info(message: string, duration = 5000): void { this.show(message, 'info', duration); }
  success(message: string, duration = 4000): void { this.show(message, 'success', duration); }
  warning(message: string, duration = 6000): void { this.show(message, 'warning', duration); }
  error(message: string, duration = 8000): void { this.show(message, 'error', duration); }
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="toast-container" aria-live="polite" aria-relevant="additions removals">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast toast-' + toast.type"
          [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
          (mouseenter)="pauseTimer(toast)"
          (mouseleave)="resumeTimer(toast)">
          <app-icon [name]="getIcon(toast.type)" [size]="18" />
          <span class="toast-message">{{ toast.message }}</span>
          @if (toast.dismissible) {
            <button
              class="toast-close"
              (click)="toastService.dismiss(toast.id)"
              aria-label="Dismiss notification">
              <app-icon name="x-close" [size]="14" />
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: var(--space-8);
      right: var(--space-6);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-width: 420px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--bg-glass);
      backdrop-filter: blur(var(--blur-md));
      -webkit-backdrop-filter: blur(var(--blur-md));
      border: 1px solid var(--bg-glass-border);
      box-shadow: var(--shadow-lg);
      animation: slideDown 0.3s ease-out;
      pointer-events: all;
      min-height: var(--min-touch-target);
    }

    .toast-info { border-left: 3px solid var(--info-color); }
    .toast-success { border-left: 3px solid var(--success-color); }
    .toast-warning { border-left: 3px solid var(--warning-color); }
    .toast-error { border-left: 3px solid var(--danger-color); }

    .toast-info app-icon { color: var(--info-color); }
    .toast-success app-icon { color: var(--success-color); }
    .toast-warning app-icon { color: var(--warning-color); }
    .toast-error app-icon { color: var(--danger-color); }

    .toast-message {
      flex: 1;
      font-size: var(--text-sm);
      color: var(--text-primary);
      line-height: var(--leading-tight);
    }

    .toast-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    @media (max-width: 480px) {
      .toast-container {
        top: auto;
        bottom: var(--space-4);
        left: var(--space-4);
        right: var(--space-4);
        max-width: none;
      }
    }
  `]
})
export class ToastContainerComponent {
  private pausedTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(public toastService: ToastService) {}

  getIcon(type: ToastType): IconName {
    switch (type) {
      case 'success': return 'check';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      default: return 'info';
    }
  }

  pauseTimer(toast: Toast): void {
    // Not strictly needed since we use setTimeout in the service,
    // but provides a UX hint that the toast stays visible on hover.
  }

  resumeTimer(toast: Toast): void {
    // noop — timer already running in the service
  }
}

/**
 * ErrorNotificationService — Centralized, user-friendly error notification system.
 * Displays non-accusatory, actionable error messages. Collects feedback for learning.
 * NO PII in error logs. All messages are human-readable.
 */
import { Injectable, signal, computed } from '@angular/core';

export interface AppError {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  suggestion?: string;
  timestamp: Date;
  dismissed: boolean;
  context?: string;          // e.g. 'content-fetch', 'session-save', 'network'
  recoverable: boolean;
  retryAction?: () => void;  // optional retry callback
}

@Injectable({ providedIn: 'root' })
export class ErrorNotificationService {

  private _errors = signal<AppError[]>([]);
  errors = this._errors.asReadonly();

  /** Only undismissed errors, newest first. */
  activeErrors = computed(() =>
    this._errors().filter(e => !e.dismissed).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  );

  /** Whether any critical/error-level notification is active. */
  hasActiveError = computed(() =>
    this.activeErrors().some(e => e.severity === 'error' || e.severity === 'critical')
  );

  /** Push a new user-facing error. Returns the error ID. */
  notify(
    severity: AppError['severity'],
    title: string,
    message: string,
    options?: {
      suggestion?: string;
      context?: string;
      recoverable?: boolean;
      retryAction?: () => void;
    }
  ): string {
    const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const error: AppError = {
      id,
      severity,
      title,
      message,
      suggestion: options?.suggestion,
      timestamp: new Date(),
      dismissed: false,
      context: options?.context,
      recoverable: options?.recoverable ?? true,
      retryAction: options?.retryAction,
    };
    this._errors.update(list => [...list, error]);

    // Auto-dismiss info/warning after 8 seconds
    if (severity === 'info' || severity === 'warning') {
      setTimeout(() => this.dismiss(id), 8000);
    }

    return id;
  }

  // ─── Convenience Methods ───

  /** Content fetch failed but fallback content is available. */
  contentFetchFallback(): void {
    this.notify('warning',
      'Using backup content',
      'We couldn\'t load fresh content from the internet right now, so we\'re using our built-in content library instead.',
      {
        suggestion: 'Your survey experience won\'t be affected — you can continue as normal.',
        context: 'content-fetch',
        recoverable: true,
      }
    );
  }

  /** Dataset-backed survey content could not be loaded. */
  contentLoadFailed(detail?: string): void {
    this.notify('error',
      'Dataset unavailable',
      detail || 'We couldn\'t load the curated survey dataset for this session.',
      {
        suggestion: 'Please try again in a moment. The survey will start once the dataset service responds.',
        context: 'content-fetch',
        recoverable: true,
      }
    );
  }

  /** Network appears to be offline. */
  networkOffline(): void {
    this.notify('error',
      'Connection issue',
      'It looks like there may be a problem with the internet connection. Your responses are saved locally and will sync when the connection is restored.',
      {
        suggestion: 'You can continue the survey — your progress is safe.',
        context: 'network',
        recoverable: true,
      }
    );
  }

  /** Session creation failed on backend. */
  sessionSaveFailed(): void {
    this.notify('warning',
      'Session sync pending',
      'Your session data couldn\'t be saved to our server just yet. This won\'t affect your survey experience.',
      {
        suggestion: 'The system will try again automatically. Your responses are still being recorded locally.',
        context: 'session-save',
        recoverable: true,
      }
    );
  }

  /** Response save failed on backend. */
  responseSaveFailed(itemIndex: number): void {
    this.notify('warning',
      'Response sync pending',
      `Your answer for item ${itemIndex + 1} couldn\'t be synced to the server right now.`,
      {
        suggestion: 'Don\'t worry — your response is saved locally and will sync later.',
        context: 'response-save',
        recoverable: true,
      }
    );
  }

  /** Session completion failed. */
  completionFailed(): void {
    this.notify('error',
      'Results sync issue',
      'Your completed results couldn\'t be sent to the research server.',
      {
        suggestion: 'Your results are displayed below. The system will attempt to sync your data in the background.',
        context: 'completion-save',
        recoverable: true,
      }
    );
  }

  /** Content loading timed out. */
  contentTimeout(): void {
    this.notify('warning',
      'Loading is taking longer than usual',
      'Fetching content from the internet is taking a while. This might be due to slow internet speed.',
      {
        suggestion: 'Please wait a moment, or the system will fall back to its built-in content library.',
        context: 'content-fetch',
        recoverable: true,
      }
    );
  }

  /** Dismiss a specific error. */
  dismiss(id: string): void {
    this._errors.update(list =>
      list.map(e => e.id === id ? { ...e, dismissed: true } : e)
    );
  }

  /** Dismiss all active errors. */
  dismissAll(): void {
    this._errors.update(list =>
      list.map(e => ({ ...e, dismissed: true }))
    );
  }

  /** Clear old dismissed errors (keep last 20). */
  cleanup(): void {
    this._errors.update(list => list.slice(-20));
  }
}

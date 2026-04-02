import { Component, Input } from '@angular/core';
import { AnalysisStatusType } from '../../models/post.model';

@Component({
  selector: 'app-analysis-status',
  standalone: true,
  imports: [],
  template: `
    <div class="status-indicator" [class]="status">
      <span class="status-dot"></span>
      <span class="status-text">{{ getLabel() }}</span>
    </div>
  `,
  styles: [`
    .status-indicator {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.7rem; font-weight: 600;
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    .none { background: var(--bg-hover); color: var(--text-muted); .status-dot { background: var(--text-muted); } }
    .pending { background: var(--warning-bg); color: var(--accent-orange); .status-dot { background: var(--accent-orange); animation: pulse 1.5s infinite; } }
    .running { background: var(--info-bg); color: var(--accent-cyan); .status-dot { background: var(--accent-cyan); animation: pulse 1s infinite; } }
    .completed { background: var(--human-bg); color: var(--accent-green); .status-dot { background: var(--accent-green); } }
    .failed { background: var(--danger-bg); color: var(--accent-red); .status-dot { background: var(--accent-red); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @media (forced-colors: active) {
      .status-dot { forced-color-adjust: none; }
    }
  `]
})
export class AnalysisStatusComponent {
  @Input() status: AnalysisStatusType = 'none';

  getLabel(): string {
    switch (this.status) {
      case 'pending': return 'Analysis Pending';
      case 'running': return 'Analyzing...';
      case 'completed': return 'Analysis Complete';
      case 'failed': return 'Analysis Failed';
      default: return 'Not Analyzed';
    }
  }
}

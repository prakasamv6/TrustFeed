import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalysisStatusType } from '../../models/post.model';

@Component({
  selector: 'app-analysis-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-indicator" [ngClass]="status">
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
    .none { background: rgba(158,158,158,0.15); color: #9e9e9e; .status-dot { background: #9e9e9e; } }
    .pending { background: rgba(255,152,0,0.15); color: #ff9800; .status-dot { background: #ff9800; animation: pulse 1.5s infinite; } }
    .running { background: rgba(0,217,255,0.15); color: #00d9ff; .status-dot { background: #00d9ff; animation: pulse 1s infinite; } }
    .completed { background: rgba(76,175,80,0.15); color: #4caf50; .status-dot { background: #4caf50; } }
    .failed { background: rgba(233,30,99,0.15); color: #e91e63; .status-dot { background: #e91e63; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
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

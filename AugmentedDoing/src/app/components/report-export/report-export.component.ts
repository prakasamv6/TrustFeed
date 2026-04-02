import { Component, Input, inject } from '@angular/core';
import { AnalysisService } from '../../services/analysis.service';
import { environment } from '../../services/environment';

@Component({
  selector: 'app-report-export',
  standalone: true,
  imports: [],
  template: `
    @if (postId) {
    <div class="report-actions">
      <button class="report-btn" (click)="downloadReport()" title="Download analysis report">
        📥 Report
      </button>
    </div>
    }
  `,
  styles: [`
    .report-actions { display: inline-flex; }
    .report-btn {
      background: var(--info-bg); border: 1px solid var(--accent-cyan);
      color: var(--accent-cyan); padding: 0.35rem 0.75rem; border-radius: 16px;
      cursor: pointer; font-size: 0.75rem; transition: all 0.3s;
      &:hover { background: var(--accent-cyan); color: var(--bg-primary); transform: translateY(-1px); }
      &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    }
  `]
})
export class ReportExportComponent {
  @Input() postId: string | null = null;
  private analysisService = inject(AnalysisService);

  downloadReport(): void {
    if (!this.postId) return;
    if (environment.mockMode) {
      this.analysisService.getAnalysis(this.postId).subscribe(result => {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${this.postId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } else {
      window.open(this.analysisService.getReportUrl(this.postId), '_blank');
    }
  }
}

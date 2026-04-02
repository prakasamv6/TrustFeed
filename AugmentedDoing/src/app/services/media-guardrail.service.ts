import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from './environment';

export interface BrokenMediaEntry {
  brokenUrl: string;
  replacementUrl: string;
  context: string;
  agentRegion: string;
  reportedAt: Date;
  status: 'auto-replaced' | 'user-reported' | 'agent-fixed';
}

const FALLBACK_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const FALLBACK_POSTER = 'https://picsum.photos/seed/video-fallback/600/400';

@Injectable({ providedIn: 'root' })
export class MediaGuardrailService {
  private http = inject(HttpClient);

  private _replacements = new Map<string, string>();
  private _healthy = new Set<string>();
  private _reports = signal<BrokenMediaEntry[]>([]);

  reports = this._reports.asReadonly();
  brokenCount = computed(() => this._reports().length);

  getReplacementUrl(url: string): string | null {
    return this._replacements.get(url) ?? null;
  }

  async probeUrl(url: string): Promise<boolean> {
    if (!url) return false;
    if (this._healthy.has(url)) return true;
    if (this._replacements.has(url)) return false;

    try {
      const ok = await new Promise<boolean>((resolve) => {
        if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
          const ctrl = new AbortController();
          const timer = setTimeout(() => { ctrl.abort(); resolve(false); }, 5000);
          fetch(url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal })
            .then(() => { clearTimeout(timer); resolve(true); })
            .catch(() => { clearTimeout(timer); resolve(false); });
        } else {
          const img = new Image();
          const timer = setTimeout(() => { img.src = ''; resolve(false); }, 5000);
          img.onload = () => { clearTimeout(timer); resolve(true); };
          img.onerror = () => { clearTimeout(timer); resolve(false); };
          img.src = url;
        }
      });
      if (ok) this._healthy.add(url);
      return ok;
    } catch {
      return false;
    }
  }

  handleBrokenImage(brokenUrl: string, context = 'unknown', agentRegion = ''): string {
    const existing = this._replacements.get(brokenUrl);
    if (existing) return existing;

    const seed = this.hashUrl(brokenUrl);
    const replacement = `https://picsum.photos/seed/${seed}/600/400`;
    this.recordBroken(brokenUrl, replacement, context, agentRegion, 'auto-replaced');
    return replacement;
  }

  handleBrokenVideo(brokenUrl: string, context = 'unknown', agentRegion = ''): { videoUrl: string; posterUrl: string } {
    const existing = this._replacements.get(brokenUrl);
    if (existing) return { videoUrl: existing, posterUrl: FALLBACK_POSTER };
    this.recordBroken(brokenUrl, FALLBACK_VIDEO, context, agentRegion, 'auto-replaced');
    return { videoUrl: FALLBACK_VIDEO, posterUrl: FALLBACK_POSTER };
  }

  userReport(brokenUrl: string, context = 'unknown', agentRegion = ''): void {
    this._reports.update(list =>
      list.map(r => r.brokenUrl === brokenUrl ? { ...r, status: 'user-reported' as const } : r)
    );
    this.http.post(`${environment.apiBase}/report-broken-media`, {
      brokenUrl, context, agentRegion,
    }).subscribe({ error: () => {} });
  }

  get fallbackVideoUrl(): string { return FALLBACK_VIDEO; }
  get fallbackPosterUrl(): string { return FALLBACK_POSTER; }

  private recordBroken(
    brokenUrl: string, replacementUrl: string,
    context: string, agentRegion: string,
    status: BrokenMediaEntry['status'],
  ): void {
    this._replacements.set(brokenUrl, replacementUrl);
    this._reports.update(list => [...list, {
      brokenUrl, replacementUrl, context, agentRegion,
      reportedAt: new Date(), status,
    }]);
    this.http.post(`${environment.apiBase}/report-broken-media`, {
      brokenUrl, context, agentRegion,
    }).subscribe({ error: () => {} });
  }

  private hashUrl(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }
}

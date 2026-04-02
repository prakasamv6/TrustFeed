import { Directive, ElementRef, HostListener, inject, input, Renderer2, OnInit, OnDestroy } from '@angular/core';
import { MediaGuardrailService } from '../services/media-guardrail.service';

@Directive({
  selector: 'video[appVideoFallback]',
  standalone: true,
})
export class VideoFallbackDirective implements OnInit, OnDestroy {
  appVideoFallback = input<string>('');
  agentRegion = input<string>('');

  private el = inject(ElementRef<HTMLVideoElement>);
  private renderer = inject(Renderer2);
  private guardrail = inject(MediaGuardrailService);
  private handled = false;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    const video = this.el.nativeElement;

    // Stall detection: if video hasn't loaded metadata in 8s, treat as broken
    this.stallTimer = setTimeout(() => {
      if (video.readyState < 1 && !this.handled) {
        this.handleBroken(video);
      }
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
  }

  @HostListener('error')
  onError(): void {
    this.handleBroken(this.el.nativeElement);
  }

  @HostListener('stalled')
  onStalled(): void {
    const video = this.el.nativeElement;
    // Wait 4s after stall—if still no data, replace
    setTimeout(() => {
      if (video.readyState < 2 && !this.handled) {
        this.handleBroken(video);
      }
    }, 4000);
  }

  private handleBroken(video: HTMLVideoElement): void {
    if (this.handled) return;
    this.handled = true;
    if (this.stallTimer) { clearTimeout(this.stallTimer); this.stallTimer = null; }

    const brokenUrl = video.src || video.querySelector('source')?.src || '';
    const ctx = this.appVideoFallback() || 'unknown';
    const region = this.agentRegion() || '';
    const fallback = this.guardrail.handleBrokenVideo(brokenUrl, ctx, region);

    // Replace video source with fallback
    this.renderer.setAttribute(video, 'src', fallback.videoUrl);
    this.renderer.setAttribute(video, 'poster', fallback.posterUrl);

    // Remove broken <source> children and add working one
    video.querySelectorAll('source').forEach(s => s.remove());
    const source = this.renderer.createElement('source');
    this.renderer.setAttribute(source, 'src', fallback.videoUrl);
    this.renderer.setAttribute(source, 'type', 'video/mp4');
    this.renderer.appendChild(video, source);

    video.load();

    this.injectOverlay(brokenUrl, ctx, region);
  }

  private injectOverlay(brokenUrl: string, ctx: string, region: string): void {
    const parent = this.el.nativeElement.parentElement;
    if (!parent) return;
    if (getComputedStyle(parent).position === 'static') {
      this.renderer.setStyle(parent, 'position', 'relative');
    }

    const wrap = this.renderer.createElement('div');
    Object.entries({
      position: 'absolute', top: '8px', right: '8px', zIndex: '10',
      display: 'flex', gap: '6px', alignItems: 'center',
    }).forEach(([k, v]) => this.renderer.setStyle(wrap, k, v));

    const badge = this.renderer.createElement('span');
    Object.entries({
      background: 'rgba(234,179,8,0.92)', color: '#1a1a1a',
      padding: '3px 8px', borderRadius: '4px',
      fontSize: '11px', fontWeight: '600', pointerEvents: 'none',
    }).forEach(([k, v]) => this.renderer.setStyle(badge, k, v));
    this.renderer.appendChild(badge, this.renderer.createText('\u26A0 Video auto-replaced'));
    this.renderer.appendChild(wrap, badge);

    const btn = this.renderer.createElement('button');
    this.renderer.setAttribute(btn, 'type', 'button');
    this.renderer.setAttribute(btn, 'title', 'Report broken video to AI agent for permanent fix');
    Object.entries({
      background: 'rgba(239,68,68,0.92)', color: '#fff', border: 'none',
      padding: '3px 10px', borderRadius: '4px', fontSize: '11px',
      fontWeight: '600', cursor: 'pointer',
    }).forEach(([k, v]) => this.renderer.setStyle(btn, k, v));
    this.renderer.appendChild(btn, this.renderer.createText('\uD83D\uDEA9 Report broken video'));

    this.renderer.listen(btn, 'click', () => {
      this.guardrail.userReport(brokenUrl, ctx, region);
      this.renderer.setProperty(btn, 'textContent', '\u2713 Reported to AI Agent');
      this.renderer.setStyle(btn, 'background', 'rgba(34,197,94,0.92)');
      this.renderer.setStyle(btn, 'cursor', 'default');
    });
    this.renderer.appendChild(wrap, btn);

    this.renderer.appendChild(parent, wrap);
  }
}

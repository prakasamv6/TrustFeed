import { Directive, ElementRef, HostListener, inject, input, Renderer2 } from '@angular/core';
import { MediaGuardrailService } from '../services/media-guardrail.service';

@Directive({
  selector: 'img[appImgFallback]',
  standalone: true,
})
export class ImgFallbackDirective {
  appImgFallback = input<string>('');
  agentRegion = input<string>('');

  private el = inject(ElementRef<HTMLImageElement>);
  private renderer = inject(Renderer2);
  private guardrail = inject(MediaGuardrailService);
  private handled = false;
  private retryCount = 0;
  private readonly MAX_RETRIES = 1;

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;
    const brokenUrl = img.src;

    // Retry once before declaring broken (handles transient network blips)
    if (!this.handled && this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      setTimeout(() => this.renderer.setAttribute(img, 'src', brokenUrl), 1500);
      return;
    }

    if (this.handled) return;
    this.handled = true;

    const ctx = this.appImgFallback() || 'unknown';
    const region = this.agentRegion() || '';
    const replacement = this.guardrail.handleBrokenImage(brokenUrl, ctx, region);
    this.renderer.setAttribute(img, 'src', replacement);

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

    // "Auto-replaced" badge
    const badge = this.createBadge('\u26A0 Image auto-replaced',
      'rgba(234,179,8,0.92)', '#1a1a1a');
    this.renderer.appendChild(wrap, badge);

    // "Report" button
    const btn = this.createButton('\uD83D\uDEA9 Report broken image');
    this.renderer.listen(btn, 'click', () => {
      this.guardrail.userReport(brokenUrl, ctx, region);
      this.renderer.setProperty(btn, 'textContent', '\u2713 Reported to AI Agent');
      this.renderer.setStyle(btn, 'background', 'rgba(34,197,94,0.92)');
      this.renderer.setStyle(btn, 'cursor', 'default');
    });
    this.renderer.appendChild(wrap, btn);

    this.renderer.appendChild(parent, wrap);
  }

  private createBadge(text: string, bg: string, color: string): HTMLElement {
    const el = this.renderer.createElement('span');
    Object.entries({
      background: bg, color, padding: '3px 8px', borderRadius: '4px',
      fontSize: '11px', fontWeight: '600', pointerEvents: 'none',
    }).forEach(([k, v]) => this.renderer.setStyle(el, k, v));
    this.renderer.appendChild(el, this.renderer.createText(text));
    return el;
  }

  private createButton(text: string): HTMLElement {
    const el = this.renderer.createElement('button');
    this.renderer.setAttribute(el, 'type', 'button');
    this.renderer.setAttribute(el, 'title', 'Report this broken image to the AI agent for a permanent fix');
    Object.entries({
      background: 'rgba(239,68,68,0.92)', color: '#fff', border: 'none',
      padding: '3px 10px', borderRadius: '4px', fontSize: '11px',
      fontWeight: '600', cursor: 'pointer',
    }).forEach(([k, v]) => this.renderer.setStyle(el, k, v));
    this.renderer.appendChild(el, this.renderer.createText(text));
    return el;
  }
}

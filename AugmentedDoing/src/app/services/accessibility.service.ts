import { Injectable, signal, computed, OnDestroy, Renderer2, RendererFactory2 } from '@angular/core';

export type ThemeMode = 'dark' | 'light' | 'system';
export type FontSize = 'small' | 'medium' | 'large';
export type AnimationLevel = 'full' | 'reduced' | 'none';
export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';

const STORAGE_KEY = 'trustfeed_a11y_prefs';

interface A11yPreferences {
  theme: ThemeMode;
  fontSize: FontSize;
  animationLevel: AnimationLevel;
  density: LayoutDensity;
  highContrast: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccessibilityService implements OnDestroy {
  private renderer: Renderer2;
  private mediaQueryReducedMotion: MediaQueryList;
  private mediaQueryColorScheme: MediaQueryList;
  private mediaQueryContrast: MediaQueryList;

  /* System detection signals */
  readonly prefersReducedMotion = signal(false);
  readonly prefersLightScheme = signal(false);
  readonly prefersHighContrast = signal(false);

  /* User preference signals */
  readonly theme = signal<ThemeMode>('system');
  readonly fontSize = signal<FontSize>('medium');
  readonly animationLevel = signal<AnimationLevel>('full');
  readonly density = signal<LayoutDensity>('comfortable');
  readonly highContrast = signal(false);

  /* Computed effective theme */
  readonly effectiveTheme = computed<'dark' | 'light'>(() => {
    const t = this.theme();
    if (t === 'system') return this.prefersLightScheme() ? 'light' : 'dark';
    return t;
  });

  readonly shouldReduceMotion = computed(() =>
    this.animationLevel() !== 'full' || this.prefersReducedMotion()
  );

  /* Live-region announcement queue */
  private announceEl: HTMLElement | null = null;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);

    this.mediaQueryReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mediaQueryColorScheme = window.matchMedia('(prefers-color-scheme: light)');
    this.mediaQueryContrast = window.matchMedia('(prefers-contrast: more)');

    this.prefersReducedMotion.set(this.mediaQueryReducedMotion.matches);
    this.prefersLightScheme.set(this.mediaQueryColorScheme.matches);
    this.prefersHighContrast.set(this.mediaQueryContrast.matches);

    this.mediaQueryReducedMotion.addEventListener('change', this._onReducedMotionChange);
    this.mediaQueryColorScheme.addEventListener('change', this._onColorSchemeChange);
    this.mediaQueryContrast.addEventListener('change', this._onContrastChange);

    this._loadPreferences();
    this._createAnnounceRegion();
  }

  ngOnDestroy(): void {
    this.mediaQueryReducedMotion.removeEventListener('change', this._onReducedMotionChange);
    this.mediaQueryColorScheme.removeEventListener('change', this._onColorSchemeChange);
    this.mediaQueryContrast.removeEventListener('change', this._onContrastChange);
    this.announceEl?.remove();
  }

  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
    this._applyTheme();
    this._savePreferences();
  }

  setFontSize(size: FontSize): void {
    this.fontSize.set(size);
    this._applyFontSize();
    this._savePreferences();
  }

  setAnimationLevel(level: AnimationLevel): void {
    this.animationLevel.set(level);
    this._applyAnimations();
    this._savePreferences();
  }

  setDensity(density: LayoutDensity): void {
    this.density.set(density);
    this._applyDensity();
    this._savePreferences();
  }

  setHighContrast(enabled: boolean): void {
    this.highContrast.set(enabled);
    this._savePreferences();
  }

  announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    if (!this.announceEl) return;
    this.announceEl.setAttribute('aria-live', politeness);
    this.announceEl.textContent = '';
    requestAnimationFrame(() => {
      if (this.announceEl) this.announceEl.textContent = message;
    });
  }

  applyAllPreferences(): void {
    this._applyTheme();
    this._applyFontSize();
    this._applyAnimations();
    this._applyDensity();
  }

  private _applyTheme(): void {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    const effective = this.effectiveTheme();
    root.classList.add(`theme-${effective}`);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', effective === 'dark' ? '#0d1117' : '#f6f8fa');
    }
  }

  private _applyFontSize(): void {
    const root = document.documentElement;
    root.classList.remove('font-small', 'font-large');
    const size = this.fontSize();
    if (size !== 'medium') root.classList.add(`font-${size}`);
  }

  private _applyAnimations(): void {
    const root = document.documentElement;
    root.classList.remove('reduce-motion');
    if (this.animationLevel() !== 'full') root.classList.add('reduce-motion');
  }

  private _applyDensity(): void {
    const root = document.documentElement;
    root.classList.remove('density-compact', 'density-spacious');
    const d = this.density();
    if (d !== 'comfortable') root.classList.add(`density-${d}`);
  }

  private _loadPreferences(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs: A11yPreferences = JSON.parse(stored);
        this.theme.set(prefs.theme ?? 'system');
        this.fontSize.set(prefs.fontSize ?? 'medium');
        this.animationLevel.set(prefs.animationLevel ?? 'full');
        this.density.set(prefs.density ?? 'comfortable');
        this.highContrast.set(prefs.highContrast ?? false);
      }
    } catch { /* ignore corrupt data */ }
    this.applyAllPreferences();
  }

  private _savePreferences(): void {
    const prefs: A11yPreferences = {
      theme: this.theme(),
      fontSize: this.fontSize(),
      animationLevel: this.animationLevel(),
      density: this.density(),
      highContrast: this.highContrast(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* quota */ }
  }

  private _createAnnounceRegion(): void {
    this.announceEl = document.createElement('div');
    this.announceEl.setAttribute('aria-live', 'polite');
    this.announceEl.setAttribute('aria-atomic', 'true');
    this.announceEl.className = 'a11y-announcer';
    document.body.appendChild(this.announceEl);
  }

  private _onReducedMotionChange = (e: MediaQueryListEvent) => this.prefersReducedMotion.set(e.matches);
  private _onColorSchemeChange = (e: MediaQueryListEvent) => {
    this.prefersLightScheme.set(e.matches);
    if (this.theme() === 'system') this._applyTheme();
  };
  private _onContrastChange = (e: MediaQueryListEvent) => this.prefersHighContrast.set(e.matches);
}

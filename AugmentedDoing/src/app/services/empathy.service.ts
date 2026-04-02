import { Injectable, signal, computed, OnDestroy, NgZone } from '@angular/core';

export type UserMood = 'focused' | 'frustrated' | 'exploring' | 'idle' | 'rushed';

export interface AdaptiveUiHints {
  simplifyUI: boolean;
  showHelp: boolean;
  slowDownAnimations: boolean;
  showBreathingPrompt: boolean;
  reduceDensity: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmpathyService implements OnDestroy {
  private clickTimestamps: number[] = [];
  private scrollVelocities: number[] = [];
  private lastScrollY = 0;
  private lastScrollTime = 0;
  private backNavigationCount = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private isIdle = signal(false);
  private rageClickDetected = signal(false);
  private rapidScrollDetected = signal(false);

  private readonly RAGE_CLICK_THRESHOLD = 3;
  private readonly RAGE_CLICK_WINDOW_MS = 1500;
  private readonly IDLE_TIMEOUT_MS = 30_000;
  private readonly RAPID_SCROLL_THRESHOLD = 2000;

  readonly userMood = computed<UserMood>(() => {
    if (this.rageClickDetected()) return 'frustrated';
    if (this.isIdle()) return 'idle';
    if (this.rapidScrollDetected()) return 'rushed';
    if (this.backNavigationCount > 3) return 'frustrated';
    return 'focused';
  });

  readonly adaptiveUiHints = computed<AdaptiveUiHints>(() => {
    const mood = this.userMood();
    return {
      simplifyUI: mood === 'frustrated' || mood === 'rushed',
      showHelp: mood === 'frustrated' || mood === 'idle',
      slowDownAnimations: mood === 'frustrated',
      showBreathingPrompt: mood === 'frustrated',
      reduceDensity: mood === 'rushed',
    };
  });

  constructor(private ngZone: NgZone) {
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('click', this._onGlobalClick, { passive: true });
      document.addEventListener('scroll', this._onGlobalScroll, { passive: true });
      document.addEventListener('mousemove', this._resetIdle, { passive: true });
      document.addEventListener('keydown', this._resetIdle, { passive: true });
      this._startIdleTimer();
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this._onGlobalClick);
    document.removeEventListener('scroll', this._onGlobalScroll);
    document.removeEventListener('mousemove', this._resetIdle);
    document.removeEventListener('keydown', this._resetIdle);
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  recordBackNavigation(): void {
    this.backNavigationCount++;
    setTimeout(() => { this.backNavigationCount = Math.max(0, this.backNavigationCount - 1); }, 10_000);
  }

  resetFrustration(): void {
    this.rageClickDetected.set(false);
    this.rapidScrollDetected.set(false);
    this.backNavigationCount = 0;
  }

  private _onGlobalClick = (): void => {
    const now = Date.now();
    this.clickTimestamps.push(now);
    // Keep only recent clicks
    this.clickTimestamps = this.clickTimestamps.filter(t => now - t < this.RAGE_CLICK_WINDOW_MS);
    if (this.clickTimestamps.length >= this.RAGE_CLICK_THRESHOLD) {
      this.ngZone.run(() => this.rageClickDetected.set(true));
      // Auto-clear after 10s
      setTimeout(() => this.ngZone.run(() => this.rageClickDetected.set(false)), 10_000);
    }
    this._resetIdle();
  };

  private _onGlobalScroll = (): void => {
    const now = Date.now();
    const deltaY = Math.abs(window.scrollY - this.lastScrollY);
    const deltaT = now - this.lastScrollTime;
    if (deltaT > 0) {
      const velocity = (deltaY / deltaT) * 1000;
      this.scrollVelocities.push(velocity);
      if (this.scrollVelocities.length > 10) this.scrollVelocities.shift();
      const avgVelocity = this.scrollVelocities.reduce((a, b) => a + b, 0) / this.scrollVelocities.length;
      if (avgVelocity > this.RAPID_SCROLL_THRESHOLD) {
        this.ngZone.run(() => this.rapidScrollDetected.set(true));
        setTimeout(() => this.ngZone.run(() => this.rapidScrollDetected.set(false)), 8_000);
      }
    }
    this.lastScrollY = window.scrollY;
    this.lastScrollTime = now;
    this._resetIdle();
  };

  private _resetIdle = (): void => {
    this.isIdle.set(false);
    this._startIdleTimer();
  };

  private _startIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.ngZone.run(() => this.isIdle.set(true));
    }, this.IDLE_TIMEOUT_MS);
  }
}

import { Injectable, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export type ExperienceLevel = 'new' | 'intermediate' | 'expert';
export type InteractionStyle = 'explorer' | 'focused' | 'power-user';

export interface UserProfile {
  experienceLevel: ExperienceLevel;
  preferredContentTypes: string[];
  interactionStyle: InteractionStyle;
  visitCount: number;
  mostVisitedPage: string;
  lastSortMode: string | null;
  lastFilter: string | null;
}

export interface ContextualSuggestion {
  message: string;
  action?: string;
  route?: string;
  type: 'tip' | 'navigation' | 'feature';
}

const STORAGE_KEY = 'trustfeed_personalization';

@Injectable({ providedIn: 'root' })
export class PersonalizationService {
  private pageVisits = signal<Record<string, number>>({});
  private featureUsage = signal<Record<string, number>>({});
  private totalVisits = signal(0);
  private sessionStart = Date.now();
  private pageTimers: Record<string, number> = {};

  readonly userProfile = computed<UserProfile>(() => {
    const visits = this.pageVisits();
    const features = this.featureUsage();
    const total = this.totalVisits();

    const experienceLevel: ExperienceLevel =
      total > 20 ? 'expert' : total > 5 ? 'intermediate' : 'new';

    const pages = Object.entries(visits);
    const mostVisited = pages.length > 0
      ? pages.reduce((a, b) => a[1] > b[1] ? a : b)[0]
      : '/';

    const featureCount = Object.values(features).reduce((s, v) => s + v, 0);
    const interactionStyle: InteractionStyle =
      featureCount > 30 ? 'power-user' : pages.length > 3 ? 'explorer' : 'focused';

    return {
      experienceLevel,
      preferredContentTypes: this._inferPreferredTypes(features),
      interactionStyle,
      visitCount: total,
      mostVisitedPage: mostVisited,
      lastSortMode: this._getStored('lastSort'),
      lastFilter: this._getStored('lastFilter'),
    };
  });

  readonly showOnboarding = computed(() => this.totalVisits() <= 2);

  constructor(private router: Router) {
    this._loadState();
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(event => this._recordPageVisit(event.urlAfterRedirects));
  }

  recordFeatureUsage(feature: string): void {
    this.featureUsage.update(f => ({ ...f, [feature]: (f[feature] || 0) + 1 }));
    this._saveState();
  }

  recordPreference(key: string, value: string): void {
    try { localStorage.setItem(`trustfeed_pref_${key}`, value); } catch {}
  }

  getContextualSuggestion(): ContextualSuggestion | null {
    const profile = this.userProfile();

    if (profile.experienceLevel === 'new' && profile.visitCount <= 1) {
      return {
        message: 'Welcome to TrustFeed! Start by exploring the feed and voting on content.',
        type: 'tip',
      };
    }

    const visits = this.pageVisits();
    if ((visits['/'] || 0) > 5 && !visits['/dashboard']) {
      return {
        message: 'You\'ve been active on the feed — check out the Bias Dashboard for insights.',
        action: 'View Dashboard',
        route: '/dashboard',
        type: 'navigation',
      };
    }

    if ((visits['/review'] || 0) > 3 && !visits['/survey']) {
      return {
        message: 'Enjoyed reviewing content? Try the Survey to test your AI detection skills.',
        action: 'Start Survey',
        route: '/survey',
        type: 'navigation',
      };
    }

    return null;
  }

  getPreferredSort(): string | null {
    return this._getStored('lastSort');
  }

  getPreferredFilter(): string | null {
    return this._getStored('lastFilter');
  }

  private _recordPageVisit(url: string): void {
    const path = url.split('?')[0] || '/';
    this.pageVisits.update(v => ({ ...v, [path]: (v[path] || 0) + 1 }));
    this.totalVisits.update(v => v + 1);

    if (this.pageTimers[path]) {
      const elapsed = Date.now() - this.pageTimers[path];
      if (elapsed > 60_000) {
        this.recordFeatureUsage(`long_visit_${path}`);
      }
    }
    this.pageTimers[path] = Date.now();

    this._saveState();
  }

  private _inferPreferredTypes(features: Record<string, number>): string[] {
    const types: string[] = [];
    if (features['create_text'] || features['vote_text']) types.push('text');
    if (features['create_image'] || features['vote_image']) types.push('image');
    if (features['create_video'] || features['vote_video']) types.push('video');
    return types.length > 0 ? types : ['text'];
  }

  private _getStored(key: string): string | null {
    try { return localStorage.getItem(`trustfeed_pref_${key}`); } catch { return null; }
  }

  private _loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        this.pageVisits.set(state.pageVisits ?? {});
        this.featureUsage.set(state.featureUsage ?? {});
        this.totalVisits.set(state.totalVisits ?? 0);
      }
    } catch {}
  }

  private _saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        pageVisits: this.pageVisits(),
        featureUsage: this.featureUsage(),
        totalVisits: this.totalVisits(),
      }));
    } catch {}
  }
}

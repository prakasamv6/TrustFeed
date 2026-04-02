import { Component, HostListener, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ToastContainerComponent } from './components/toast/toast.component';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { CommandPaletteComponent } from './components/command-palette/command-palette.component';
import { TransparencyPanelComponent } from './components/transparency-panel/transparency-panel.component';
import { AccessibilityService } from './services/accessibility.service';
import { routeAnimations } from './app.routes';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    ToastContainerComponent,
    SettingsPanelComponent,
    CommandPaletteComponent,
    TransparencyPanelComponent,
  ],
  template: `
    <div class="app-container" [class.theme-transitioning]="themeTransitioning">
      <app-header
        (openSettings)="showSettings.set(true)"
        (openTransparency)="showTransparency.set(true)"
        (openCommandPalette)="showCommandPalette.set(true)" />

      <main id="main-content" role="main" aria-label="Main content">
        <router-outlet />
      </main>

      <app-toast-container />

      @if (showSettings()) {
        <app-settings-panel (close)="showSettings.set(false)" />
      }

      @if (showCommandPalette()) {
        <app-command-palette (close)="showCommandPalette.set(false)" />
      }

      @if (showTransparency()) {
        <app-transparency-panel (close)="showTransparency.set(false)" />
      }
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: var(--bg-primary);
      transition: background-color var(--transition-slow);
    }

    main {
      min-height: calc(100vh - var(--header-height));
    }

    .theme-transitioning * {
      transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease !important;
    }
  `],
})
export class AppComponent implements OnInit {
  title = 'TrustFeed - AI Content Transparency Platform';

  showSettings = signal(false);
  showCommandPalette = signal(false);
  showTransparency = signal(false);
  themeTransitioning = false;

  constructor(private a11y: AccessibilityService) {}

  ngOnInit(): void {
    this.a11y.applyAllPreferences();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    // Ctrl+K or Cmd+K → Command Palette
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.showCommandPalette.set(!this.showCommandPalette());
    }
    // Escape → close all overlays
    if (event.key === 'Escape') {
      if (this.showCommandPalette()) this.showCommandPalette.set(false);
      else if (this.showSettings()) this.showSettings.set(false);
      else if (this.showTransparency()) this.showTransparency.set(false);
    }
  }
}

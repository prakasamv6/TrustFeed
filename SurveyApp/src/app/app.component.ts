import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorToastComponent } from './components/error-toast/error-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ErrorToastComponent],
  template: `
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <span class="brand-icon">🛡️</span>
          <span class="brand-name">TrustFeed Survey</span>
        </div>
        <nav class="header-nav">
          <span class="nav-badge">Human-AI Collab</span>
          <span class="nav-badge research">Research Prototype</span>
        </nav>
      </div>
    </header>
    <main>
      <router-outlet />
    </main>
    <app-error-toast />
  `,
  styles: [`
    .app-header {
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding: 0 2rem;
      position: sticky; top: 0; z-index: 100;
    }
    .header-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      height: 60px;
    }
    .brand {
      display: flex; align-items: center; gap: 0.6rem;
      .brand-icon { font-size: 1.5rem; }
      .brand-name {
        font-size: 1.15rem; font-weight: 700; color: #e6e6e6;
        background: linear-gradient(135deg, #00d9ff, #00ff88);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
    }
    .header-nav { display: flex; gap: 0.6rem; }
    .nav-badge {
      font-size: 0.72rem; font-weight: 600; padding: 0.3rem 0.8rem;
      border-radius: 20px; background: rgba(156,39,176,0.12);
      color: #ce93d8; border: 1px solid rgba(156,39,176,0.2);
      &.research {
        background: rgba(0,217,255,0.08); color: #00d9ff;
        border-color: rgba(0,217,255,0.2);
      }
    }
    main { min-height: calc(100vh - 60px); }
  `],
})
export class AppComponent {
  title = 'SurveyApp';
}

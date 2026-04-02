import { Component, EventEmitter, Output, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: string;
  action: () => void;
  category: string;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <!-- Backdrop -->
    <div class="palette-backdrop" (click)="close.emit()" aria-hidden="true"></div>

    <!-- Dialog -->
    <div
      class="palette-dialog"
      role="combobox"
      aria-expanded="true"
      aria-haspopup="listbox"
      aria-label="Command palette"
      (keydown)="onKeydown($event)">

      <!-- Search input -->
      <div class="palette-search">
        <app-icon name="search" [size]="18" />
        <input
          #searchInput
          type="text"
          class="palette-input"
          placeholder="Type a command or search..."
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearch($event)"
          role="searchbox"
          aria-label="Search commands"
          aria-controls="command-list"
          [attr.aria-activedescendant]="activeId()"
          autocomplete="off" />
        <kbd class="palette-key">Esc</kbd>
      </div>

      <!-- Results list -->
      <ul id="command-list" class="palette-list" role="listbox" aria-label="Commands">
        @for (item of filteredItems(); track item.id; let i = $index) {
          <li
            [id]="'cmd-' + item.id"
            class="palette-item"
            [class.active]="i === activeIndex()"
            role="option"
            [attr.aria-selected]="i === activeIndex()"
            (click)="executeItem(item)"
            (mouseenter)="activeIndex.set(i)">
            <app-icon [name]="$any(item.icon)" [size]="16" />
            <span class="item-label">{{ item.label }}</span>
            <span class="item-category">{{ item.category }}</span>
            @if (item.shortcut) {
              <kbd class="item-shortcut">{{ item.shortcut }}</kbd>
            }
          </li>
        }
        @if (filteredItems().length === 0) {
          <li class="palette-empty" role="option" aria-disabled="true">
            No results found
          </li>
        }
      </ul>

      <div class="palette-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>↵</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  `,
  styles: [`
    .palette-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: var(--z-command-palette);
      animation: fadeIn 0.15s ease-out;
    }

    .palette-dialog {
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      width: min(560px, 90vw);
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      z-index: calc(var(--z-command-palette) + 1);
      animation: scaleIn 0.2s ease-out;
      overflow: hidden;
    }

    .palette-search {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border-default);
      color: var(--text-muted);
    }

    .palette-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-size: var(--text-base);
      font-family: var(--font-sans);

      &::placeholder { color: var(--text-placeholder); }
    }

    .palette-key {
      padding: 2px 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: 4px;
      font-size: var(--text-xs);
      color: var(--text-muted);
      font-family: var(--font-sans);
    }

    .palette-list {
      list-style: none;
      max-height: 320px;
      overflow-y: auto;
      padding: var(--space-2);
    }

    .palette-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background var(--transition-fast);
      min-height: var(--min-touch-target);
      color: var(--text-secondary);

      &:hover, &.active {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .item-label { flex: 1; font-size: var(--text-sm); }
    .item-category {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }
    .item-shortcut {
      padding: 2px 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    .palette-empty {
      padding: var(--space-8);
      text-align: center;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }

    .palette-footer {
      display: flex;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-5);
      border-top: 1px solid var(--border-default);
      font-size: var(--text-xs);
      color: var(--text-muted);

      kbd {
        padding: 1px 4px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 3px;
        font-size: 0.65rem;
        margin-right: 2px;
      }
    }
  `]
})
export class CommandPaletteComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  searchQuery = '';
  activeIndex = signal(0);
  activeId = computed(() => {
    const items = this.filteredItems();
    const idx = this.activeIndex();
    return items[idx] ? 'cmd-' + items[idx].id : '';
  });

  private allItems: CommandItem[] = [];
  filteredItems = signal<CommandItem[]>([]);

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.allItems = [
      { id: 'feed', label: 'Go to Feed', shortcut: 'G F', icon: 'activity', category: 'Navigation', action: () => this.navigate('/') },
      { id: 'review', label: 'Go to Content Review', shortcut: 'G R', icon: 'eye', category: 'Navigation', action: () => this.navigate('/review') },
      { id: 'dashboard', label: 'Go to Bias Dashboard', shortcut: 'G D', icon: 'chart', category: 'Navigation', action: () => this.navigate('/dashboard') },
      { id: 'survey', label: 'Go to Survey', shortcut: 'G S', icon: 'clipboard', category: 'Navigation', action: () => this.navigate('/survey') },
      { id: 'settings', label: 'Open Settings', icon: 'settings', category: 'Preferences', action: () => { this.close.emit(); } },
      { id: 'theme-dark', label: 'Switch to Dark Theme', icon: 'moon', category: 'Theme', action: () => this.close.emit() },
      { id: 'theme-light', label: 'Switch to Light Theme', icon: 'sun', category: 'Theme', action: () => this.close.emit() },
      { id: 'help', label: 'Keyboard Shortcuts', shortcut: '?', icon: 'keyboard', category: 'Help', action: () => this.close.emit() },
    ];
    this.filteredItems.set(this.allItems);

    setTimeout(() => {
      const input = document.querySelector('.palette-input') as HTMLInputElement;
      input?.focus();
    });
  }

  onSearch(query: string): void {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.filteredItems.set(this.allItems);
    } else {
      this.filteredItems.set(
        this.allItems.filter(item =>
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        )
      );
    }
    this.activeIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.filteredItems();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(Math.min(this.activeIndex() + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (items[this.activeIndex()]) {
          this.executeItem(items[this.activeIndex()]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.close.emit();
        break;
    }
  }

  executeItem(item: CommandItem): void {
    item.action();
    this.close.emit();
  }

  private navigate(path: string): void {
    this.router.navigate([path]);
  }
}

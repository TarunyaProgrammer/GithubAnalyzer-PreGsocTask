import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Dart: '#00B4AB',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Rust: '#dea584',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Shell: '#89e051',
  Makefile: '#427819',
};

@Component({
  selector: 'app-language-dot',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span 
      class="color-dot" 
      [style.background-color]="color"
      [style.width.px]="size"
      [style.height.px]="size">
    </span>
    <span *ngIf="showLabel" class="label text-muted">{{ language }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .color-dot {
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .label {
      font-size: 13px;
    }
  `
})
export class LanguageDotComponent {
  @Input() language: string | null = null;
  @Input() size = 10;
  @Input() showLabel = true;

  get color(): string {
    if (!this.language) return '#ccc';
    return LANGUAGE_COLORS[this.language] || '#ccc';
  }
}

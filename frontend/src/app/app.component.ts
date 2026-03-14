import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary" class="mat-elevation-z4 header-toolbar">
      <div class="toolbar-content">
        <span class="logo">
          <mat-icon class="logo-icon">code</mat-icon>
          WebiU
        </span>
        <span class="spacer"></span>
        <a mat-button href="https://github.com/c2siorg" target="_blank">
          <mat-icon>open_in_new</mat-icon>
          C2SI GitHub
        </a>
      </div>
    </mat-toolbar>
    
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: `
    .logo {
      display: flex;
      align-items: center;
      font-weight: 500;
      letter-spacing: 0.5px;
      font-size: 1.2rem;
    }
    .logo-icon {
      margin-right: 8px;
    }
    .toolbar-content {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      padding: 0 16px;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .header-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
    }
  `
})
export class AppComponent {}

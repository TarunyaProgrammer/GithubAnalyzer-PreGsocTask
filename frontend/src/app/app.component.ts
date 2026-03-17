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
          RepoArg
        </span>
        <span class="spacer"></span>
        <a mat-button href="https://github.com/c2siorg" target="_blank">
          <mat-icon>open_in_new</mat-icon>
          C2SI GitHub
        </a>
      </div>
    </mat-toolbar>

    <div class="info-banner">
      <div class="info-content">
        <mat-icon class="info-icon">info</mat-icon>
        <span>
          This project is developed as a <strong>Pre-GSoC 2026 task</strong> for <strong>C2SI</strong>. 
          Currently, only repositories within the <strong>C2SI organization</strong> can be analyzed.
        </span>
      </div>
    </div>
    
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
    .info-banner {
      background-color: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
      padding: 8px 16px;
      font-size: 0.85rem;
      color: #616161;
    }
    .info-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
    }
    .info-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 8px;
      color: #1976d2;
    }
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
    }
  `
})
export class AppComponent {}

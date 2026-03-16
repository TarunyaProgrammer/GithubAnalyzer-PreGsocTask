import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

import { 
  RepositoryService, 
  Repository, 
  Contributor, 
  Language, 
  CommitActivity,
  AnalysisReport
} from '../../core/services/repository.service';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { NumberFormatPipe } from '../../shared/pipes/number-format.pipe';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { LanguageDotComponent } from '../../shared/components/language-dot.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';

@Component({
  selector: 'app-repository-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatDividerModule,
    NgChartsModule,
    RelativeTimePipe,
    NumberFormatPipe,
    SkeletonComponent
  ],
  templateUrl: './repository-detail.component.html',
  styleUrls: ['./repository-detail.component.css']
})
export class RepositoryDetailComponent implements OnInit, OnDestroy {
  repositoryId!: string;
  repo: Repository | null = null;
  contributors: Contributor[] = [];
  languages: Language[] = [];
  activity: CommitActivity[] = [];
  analysisReport: AnalysisReport | null = null;

  loadingRepo = true;
  loadingExtra = true;
  loadingAnalysis = true;
  analyzing = false;
  error = false;

  private destroy$ = new Subject<void>();

  // Activity Chart Data
  activityChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: []
  };
  activityChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const date = items[0].label as string;
            return `Week of ${new Date(date).toLocaleDateString()}`;
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
      x: {
        ticks: {
          callback: function(val, index) {
            // Show fewer labels on x-axis
            return index % 4 === 0 ? this.getLabelForValue(val as number) : '';
          }
        }
      }
    }
  };

  // Language Chart Data
  languageChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: []
  };
  languageChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { position: 'right' }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private repositoryService: RepositoryService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.repositoryId = id;
        this.loadData();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loadingRepo = true;
    this.loadingExtra = true;
    this.error = false;

    // Load Basic Repo Data First (fast)
    this.repositoryService.getRepository(this.repositoryId)
      .subscribe({
        next: (repo) => {
          this.repo = repo;
          this.loadingRepo = false;
          this.loadAnalysisReport();
        },
        error: () => {
          this.error = true;
          this.loadingRepo = false;
        }
      });

    // Load Additional Data (Contributors, Languages, Activity) parallel
    forkJoin({
      contributors: this.repositoryService.getContributors(this.repositoryId),
      languages: this.repositoryService.getLanguages(this.repositoryId),
      activity: this.repositoryService.getActivity(this.repositoryId)
    }).subscribe({
      next: (results) => {
        this.contributors = results.contributors;
        
        // Setup Language Chart
        this.languages = results.languages;
        this.languageChartData = {
          labels: this.languages.map(l => l.language),
          datasets: [{
            data: this.languages.map(l => Number(l.bytes)),
            backgroundColor: this.getLanguageColors(this.languages.map(l => l.language))
          }]
        };

        // Setup Activity Chart
        this.activity = results.activity;
        this.activityChartData = {
          labels: this.activity.map(a => a.weekStart),
          datasets: [{
            data: this.activity.map(a => a.commitCount),
            backgroundColor: '#0969da',
            borderRadius: 2
          }]
        };

        this.loadingExtra = false;
      },
      error: () => {
        // We don't fail the whole page if extra data fails
        this.loadingExtra = false;
      }
    });
  }

  loadAnalysisReport(): void {
    this.loadingAnalysis = true;
    this.repositoryService.getAnalysisReport(this.repositoryId).subscribe({
      next: (report) => {
        this.analysisReport = report;
        this.loadingAnalysis = false;
      },
      error: () => {
        this.analysisReport = null;
        this.loadingAnalysis = false;
      }
    });
  }

  analyzeNow(): void {
    if (!this.repo) return;
    this.analyzing = true;
    this.repositoryService.analyzeRepositories([this.repo.htmlUrl]).subscribe({
      next: () => {
        // Poll for completion or just wait a few seconds and reload
        setTimeout(() => {
          this.loadAnalysisReport();
          this.analyzing = false;
        }, 5000);
      },
      error: () => {
        this.analyzing = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  private getLanguageColors(langs: string[]): string[] {
    const defaultColors: Record<string, string> = {
      JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', 
      Java: '#b07219', Go: '#00ADD8', 'C++': '#f34b7d', C: '#555555',
      'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95', Dart: '#00B4AB'
    };
    return langs.map(l => defaultColors[l] || '#cccccc');
  }
}
